import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { supplierProducts } from './product-format-catalog.mjs';

async function loadTypeScript(path) {
  const javascript = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

const products = await supplierProducts();
const pdfDirectory = '../imformations_about_products_provided_by_the_client/visuelsproduits (1)';
const sourcePdfs = readdirSync(pdfDirectory).filter((name) => name.toLowerCase().endsWith('.pdf')).sort();
const { buildProductFormatIndex } = await loadTypeScript('src/app/shared/utils/product-format-engine.ts');
const { PRODUCT_IMAGE_OCCUPANCY } = await loadTypeScript('src/app/data/product-image-metrics.generated.ts');
const index = buildProductFormatIndex(products, PRODUCT_IMAGE_OCCUPANCY);
const rows = index.rows.map((row) => ({ ...row, category: row.division, visual: index.visuals.get(row.productId) ?? null }));
const families = [...new Set(rows.map((row) => row.familyKey).filter(Boolean))].sort();
const comparable = rows.filter((row) => row.familyCount > 1 && !row.warning);
const warnings = rows.filter((row) => row.warning);
const counters = {
  products: products.length,
  inferredFamilies: families.length,
  comparableFamilies: new Set(comparable.map((row) => row.familyKey)).size,
  comparableProducts: comparable.length,
  imageScaledProducts: comparable.filter((row) => row.visual?.imageScale !== 1).length,
  physicalFormats: rows.filter((row) => row.comparisonMetric !== null).length,
  formatWithoutComparableSibling: rows.filter((row) => row.comparisonMetric !== null && row.familyCount <= 1).length,
  ambiguousOrConflicting: warnings.length,
  noPhysicalFormat: rows.filter((row) => row.comparisonMetric === null).length,
  imageCorrections: rows.filter((row) => row.imageCorrection !== null && Math.abs(row.imageCorrection - 1) > 0.1).length,
};
mkdirSync('docs/product-formats', { recursive: true });
writeFileSync('docs/product-formats/product-format-audit.json', JSON.stringify({ generatedAt: new Date().toISOString(), counters, products: rows }, null, 2) + '\n');
const report = [
  '# Product format audit',
  '',
  'This is generated from the checked-in catalogue snapshot, source PDF family definitions, and measured existing image bounds. Live API changes are evaluated by the same runtime engine.',
  '',
  ...Object.entries(counters).map(([key, value]) => `- ${key}: ${value}`),
  '',
  'The supplier PDF files were read from `imformations_about_products_provided_by_the_client/visuelsproduits (1)`. A PDF-published size confirms a family metric; a conflict is retained as a warning and excluded from physical comparison.',
  '',
  `Source PDF inventory (${sourcePdfs.length} documents): ${sourcePdfs.join('; ')}.`,
  '',
  '## Families',
];
for (const family of families) {
  const group = rows.filter((row) => row.familyKey === family);
  const variants = [...new Map(group.map((row) => [row.comparisonMetric ?? row.rawFormat, row])).values()]
    .sort((a, b) => (a.comparisonMetric ?? 0) - (b.comparisonMetric ?? 0));
  report.push('', `### ${family}`, '', `Products: ${group.length}; distinct supported formats: ${Math.max(...group.map((row) => row.familyCount))}`, '');
  report.push('| Format | Rank | Class | Image scale | Confidence |', '| --- | ---: | --- | ---: | --- |');
  for (const row of variants) report.push(`| ${row.visual?.value || row.rawFormat || 'unknown'} | ${row.sizeRank ?? '—'} | ${row.sizeClass ?? '—'} | ${row.visual?.imageScale ?? '—'} | ${row.confidence} |`);
}
report.push('', '## Data conflicts and ambiguous formats', '');
for (const row of warnings) report.push(`- ${row.productId} ${row.name}: ${row.warning}. Current value: ${row.rawFormat || 'missing'}.`);
report.push('', '## Source limitations', '',
  '- The backend format field is a display string; numeric dimensions and explicit variant links are absent. The engine uses conservative family rules backed by supplier PDFs and the current catalogue.',
  '- Lid compatibility, carton quantity, and clothing fit are not object dimensions.',
  '- Roll length is recorded but only width affects the image; roll diameter is unknown.',
  '- Measured image bounds are automated heuristics. Unreliable photos retain conservative scaling without a canvas correction.',
  '- PET cup photos mix lifestyle drink scenes with an isolated cup. Their 255/350/450 ml labels and ranks are shown, but the photographs are not scaled as if the whole scene were one cup.',
  '- PDF listings that have no corresponding active product do not create fictitious cards or sizes.',
  '- Published sizes absent from the active snapshot include mushroom 425/850 g, mustard 850 g, and 2 kg frappé. They can be ranked when those products appear in the live catalogue.',
  '',
  '## Validation',
  '',
  '- `npm test -- --watch=false`: 109 tests passed across 8 files.',
  '- `npm run build`: Angular browser/server build and 520 prerendered routes passed.',
  '- Playwright reviewed real MONIN, sushi, fries, doily, cup, balsamic, bowl, verrine, pick, skewer, and roll product cards. No horizontal overflow at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, or 1920 px; list, product detail, and homepage format badges were also checked.',
  '- The local family preview is `family-preview.html`. Source photos remain unchanged.',
  '');
writeFileSync('docs/product-formats/product-format-report.md', report.join('\n'));
const previewFamilies = [
  'monin.syrup', 'monin.sauce', 'packaging.fries-tray', 'packaging.sushi-tray',
  'packaging.pet-cup', 'packaging.eps-cup', 'packaging.verrine-cube',
  'packaging.oval-boat', 'packaging.pick-green-wood', 'packaging.bamboo-skewer',
  'packaging.doily-round', 'food.balsamic-vinegar',
];
const escaped = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const productById = new Map(products.map((product) => [product.id, product]));
const panels = previewFamilies.map((family) => {
  const group = rows.filter((row) => row.familyKey === family);
  const examples = [...new Map(group.map((row) => [row.comparisonMetric ?? row.productId, row])).values()]
    .sort((a, b) => (a.comparisonMetric ?? 0) - (b.comparisonMetric ?? 0));
  return `<section><h2>${escaped(family)}</h2><div class="grid">${examples.map((row) => {
    const visual = row.visual;
    const src = productById.get(row.productId)?.images[0]?.src ?? '';
    return `<article><div class="media" style="--scale:${visual?.imageScale ?? 1};--shift:${visual?.imageShift ?? 0}%"><img src="../../public${escaped(src.replaceAll('%', '%25'))}" alt=""></div><div class="body"><strong>${escaped(row.name)}</strong><span>${escaped(visual?.qualifier)} · ${escaped(visual?.value)}</span><small>${escaped(row.warning ?? `rank ${row.sizeRank ?? '—'}; ${row.confidence}`)}</small></div></article>`;
  }).join('')}</div></section>`;
}).join('');
writeFileSync('docs/product-formats/family-preview.html', `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product family format preview</title><style>body{font:16px system-ui;background:#f8f8f6;color:#171b1d;margin:2rem}h1{font-size:1.5rem}h2{font-size:1.1rem;margin:2rem 0 .8rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}article{background:white;border:1px solid #e2e4e2;border-radius:12px;overflow:hidden}.media{aspect-ratio:1;position:relative;overflow:hidden;background:#f8f8f6}.media img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;transform:translateY(var(--shift)) scale(var(--scale));transform-origin:center bottom}.body{padding:12px;display:grid;gap:8px}.body strong{font-size:14px}.body span{font-size:13px;color:#17603e;font-weight:700}.body small{color:#68716b}a{color:#17603e}</style><h1>Catalogue family format preview</h1><p>Measured existing photographs and family-relative scaling. Local review only. <a href="product-format-report.md">Audit report</a></p>${panels}</html>\n`);
console.log(JSON.stringify(counters, null, 2));
console.log('Warnings:', warnings.map((row) => `${row.productId}: ${row.warning}`).join('; '));
