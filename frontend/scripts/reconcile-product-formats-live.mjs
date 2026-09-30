import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { supplierProducts } from './product-format-catalog.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:8081/api/products';
const pageSize = 100;
const first = await fetch(`${base}?page=0&pageSize=${pageSize}`);
if (!first.ok) throw new Error(`Local catalogue API returned ${first.status}`);
const firstPage = await first.json();
const pages = await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, async (_, index) => {
  const response = await fetch(`${base}?page=${index + 1}&pageSize=${pageSize}`);
  if (!response.ok) throw new Error(`Catalogue page ${index + 1} returned ${response.status}`);
  return (await response.json()).items;
}));
const live = [firstPage.items, ...pages].flat();
const snapshot = await supplierProducts();
const liveById = new Map(live.map((product) => [product.sourceId, product]));
const snapshotById = new Map(snapshot.map((product) => [product.id, product]));
const diffs = [];
for (const product of snapshot) {
  const api = liveById.get(product.id);
  if (!api) { diffs.push({ productId: product.id, field: 'presence', snapshot: 'present', live: 'missing' }); continue; }
  const values = [
    ['name.fr', product.name.fr, api.name?.fr],
    ['formats', product.formats.map((format) => format.value).join(' | '), api.formats?.map((format) => format.value).join(' | ')],
    ['categoryId', product.categoryId, api.categoryId],
    ['subcategoryId', product.subcategoryId || null, api.subcategoryId],
    ['brandId', product.brandId || null, api.brandId],
    ['image', product.images[0]?.src.match(/\/img\/products\/.*/)?.[0], api.images?.[0]?.src.match(/\/img\/products\/[^?#]+/)?.[0]],
  ];
  for (const [field, bundledValue, liveValue] of values) if (bundledValue !== liveValue)
    diffs.push({ productId: product.id, field, snapshot: bundledValue, live: liveValue });
}
for (const product of live) if (!snapshotById.has(product.sourceId))
  diffs.push({ productId: product.sourceId, field: 'presence', snapshot: 'missing', live: 'present' });

const engineText = readFileSync('src/app/shared/utils/product-format-engine.ts', 'utf8');
const javascript = ts.transpileModule(engineText, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { buildProductFormatIndex } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const liveProducts = live.map((product) => ({
  id: product.sourceId, name: { fr: product.name.fr, en: product.name.en || product.name.fr },
  categoryId: product.categoryId, subcategoryId: product.subcategoryId,
  brandId: product.brandId, formats: product.formats,
  images: product.images,
}));
const liveRows = buildProductFormatIndex(liveProducts).rows;
const result = {
  checkedAt: new Date().toISOString(),
  source: base,
  snapshotProducts: snapshot.length,
  apiProducts: live.length,
  fieldDifferences: diffs.length,
  comparableProducts: liveRows.filter((row) => row.familyCount > 1 && !row.warning).length,
  sourceConflicts: liveRows.filter((row) => row.warning).map((row) => ({ productId: row.productId, warning: row.warning })),
  differences: diffs,
};
writeFileSync('docs/product-formats/live-api-reconciliation.json', JSON.stringify(result, null, 2) + '\n');
const reportPath = 'docs/product-formats/product-format-report.md';
const report = readFileSync(reportPath, 'utf8').split('\n## Live API reconciliation')[0];
writeFileSync(reportPath, report.trimEnd() + '\n\n## Live API reconciliation\n\n' +
  `Local GET API: ${live.length} products; checked-in snapshot: ${snapshot.length}. ` +
  `${diffs.filter((item) => item.field === 'formats').length} format-value differences, ` +
  `${diffs.filter((item) => item.field === 'image').length} image URL encoding differences. ` +
  `The runtime asset-key normalizer maps those encoded image names to the measured files. ` +
  `See \`live-api-reconciliation.json\` for individual fields.\n`);
console.log(JSON.stringify({ ...result, differences: undefined }, null, 2));
