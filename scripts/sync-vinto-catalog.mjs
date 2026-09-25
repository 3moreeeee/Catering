// Rebuilds the three non-MONIN catalogues from the current Vinto crawl.
// Usage: node scripts/sync-vinto-catalog.mjs [--download-images]

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMeasures, parsePackQuantity, toSlug } from './lib/normalize.mjs';
import { translateName } from './lib/lexicon.mjs';
import { detectBrand, mapTaxonomy } from './lib/taxonomy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditDir = path.join(root, 'tmp', 'vinto-import');
const imageDir = path.join(root, 'public', 'img', 'products', 'vinto');
const target = path.join(root, 'src', 'app', 'data', 'products.imported.data.ts');
const downloadImages = process.argv.includes('--download-images');
const source = JSON.parse(await readFile(path.join(auditDir, 'raw-products.json'), 'utf8'));

const SOURCE_CATEGORY = new Map([
  ['Agro-Alimentaire', 'food'],
  ['Emballage', 'packaging'],
  ['Hygiène', 'hygiene'],
]);
const PUBLISHED_BRANDS = new Set([
  'caterware',
  'dijona',
  'emporium',
  'martellato',
  'mayor',
  'varvello',
]);
const FAMILY_LABEL = {
  food: { en: 'professional food-service product', fr: 'produit agro-alimentaire professionnel' },
  packaging: { en: 'professional packaging product', fr: 'article d’emballage professionnel' },
  hygiene: { en: 'professional hygiene product', fr: 'produit d’hygiène professionnel' },
};
const INDUSTRIES = {
  food: ['restaurants', 'hotels', 'retail', 'food-production'],
  packaging: ['restaurants', 'hotels', 'retail', 'food-production'],
  hygiene: ['restaurants', 'hotels', 'healthcare', 'pharmaceutical', 'food-production'],
};

const clean = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();
const exists = async (file) => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};
const sourceKey = (record) =>
  new URL(record.sourceUrl).pathname
    .split('/')
    .pop()
    .match(/^(\d+(?:-\d+)?)-/)?.[1] ?? record.sourceId;
const masterName = (record) => `${sourceKey(record)}-${toSlug(clean(record.name))}.jpg`;
const localName = (record) => `${sourceKey(record)}-${toSlug(clean(record.name))}.v2.webp`;

const records = [
  ...new Map(
    source
      .filter((record) => SOURCE_CATEGORY.has(record.category))
      .map((record) => [sourceKey(record), record]),
  ).values(),
].map((record) => {
  const categoryId = SOURCE_CATEGORY.get(record.category);
  const mapped = mapTaxonomy({
    name: record.name,
    family: record.family,
    division: record.category,
  });
  let subcategoryId = mapped.categoryId === categoryId ? mapped.subcategoryId : null;
  if (categoryId === 'packaging' && mapped.subcategoryId === 'doilies') {
    subcategoryId = 'films-papers';
  }
  if (mapped.via === 'needs-new-family' && mapped.familyKey === 'detergent') {
    subcategoryId = 'cleaning-chemicals';
  }
  subcategoryId ??= {
    food: 'sauces-dressings',
    packaging: 'equipment',
    hygiene: 'paper-wiping',
  }[categoryId];

  const manufacturer = toSlug(record.manufacturerName || '');
  const detected = detectBrand(record.name);
  const brandId = PUBLISHED_BRANDS.has(manufacturer)
    ? manufacturer
    : PUBLISHED_BRANDS.has(detected)
      ? detected
      : '';
  return {
    ...record,
    sourceId: sourceKey(record),
    categoryId,
    subcategoryId,
    brandId,
    masterImage: masterName(record),
    localImage: localName(record),
  };
});

if (records.length !== 190)
  throw new Error(`Expected 190 unique non-MONIN Vinto products, found ${records.length}`);
if (records.some((record) => JSON.stringify(record).toLowerCase().includes('delicio'))) {
  throw new Error('Delicio appeared in the Vinto source; refusing to publish it');
}

await mkdir(imageDir, { recursive: true });
if (downloadImages) {
  let cursor = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (cursor < records.length) {
      const index = cursor++;
      const record = records[index];
      const destination = path.join(imageDir, record.masterImage);
      if (await exists(destination)) continue;
      if (!record.imageUrl) throw new Error(`Missing image URL for ${record.sourceUrl}`);
      const response = await fetch(record.imageUrl, {
        headers: { 'User-Agent': 'fk-catering-catalogue-sync/1.0 (+https://catering.com.tn)' },
      });
      if (!response.ok) throw new Error(`${response.status} while fetching ${record.imageUrl}`);
      await writeFile(destination, Buffer.from(await response.arrayBuffer()));
      process.stdout.write(`\rDownloaded ${index + 1}/${records.length}`);
    }
  });
  await Promise.all(workers);
  process.stdout.write('\n');
}

const featuredCounts = new Map();
const tuples = records.map((record) => {
  const nameFr = clean(record.name);
  const nameEn = clean(translateName(nameFr).english) || nameFr;
  const measures = parseMeasures(`${nameFr} ${record.reference ?? ''}`);
  const packQuantity = parsePackQuantity(`${nameFr} ${record.reference ?? ''}`)?.quantity ?? 0;
  const format = measures.map((measure) => `${measure.value} ${measure.unit}`).join(' · ');
  const categoryIndex = featuredCounts.get(record.categoryId) ?? 0;
  featuredCounts.set(record.categoryId, categoryIndex + 1);
  return [
    record.sourceId,
    `vinto-${toSlug(nameFr)}-${record.sourceId}`,
    nameEn,
    nameFr,
    record.categoryId,
    record.subcategoryId,
    record.brandId,
    format,
    packQuantity,
    record.localImage,
    categoryIndex < 6,
    record.sourceUrl,
  ];
});

const generated = `// GENERATED by scripts/sync-vinto-catalog.mjs from the public Vinto catalogue.
// Source snapshot: ${new Date().toISOString().slice(0, 10)}. Prices and stock are intentionally excluded.

import { Product } from '../shared/models/catalog.model';

type VintoSource = readonly [
  sourceId: string, slug: string, nameEn: string, nameFr: string,
  categoryId: 'food' | 'packaging' | 'hygiene', subcategoryId: string,
  brandId: string, format: string, packQuantity: number, image: string,
  featured: boolean, sourceUrl: string,
];

const LABEL = ${JSON.stringify(FAMILY_LABEL, null, 2)} as const;
const INDUSTRIES = ${JSON.stringify(INDUSTRIES, null, 2)} as const;
const VINTO_SOURCE: readonly VintoSource[] = ${JSON.stringify(tuples, null, 2)};

export const IMPORTED_PRODUCTS: readonly Product[] = VINTO_SOURCE.map(
  ([sourceId, slug, nameEn, nameFr, categoryId, subcategoryId, brandId, format, packQuantity, image, featured]) => {
    const id = \`p-vinto-\${sourceId}\`;
    const label = LABEL[categoryId];
    const formatEn = format ? \` Format: \${format}.\` : '';
    const formatFr = format ? \` Format : \${format}.\` : '';
    return {
      id, slug, name: { en: nameEn, fr: nameFr },
      shortDescription: {
        en: \`\${label.en} selected for restaurants, hotels and food-service professionals.\${formatEn}\`,
        fr: \`\${label.fr.charAt(0).toUpperCase() + label.fr.slice(1)} sélectionné pour les restaurants, hôtels et professionnels.\${formatFr}\`,
      },
      description: {
        en: \`\${nameEn} is part of the current Vinto professional catalogue.\${formatEn} Availability and lead times are confirmed on request.\`,
        fr: \`\${nameFr} fait partie du catalogue professionnel Vinto actuel.\${formatFr} La disponibilité et les délais sont confirmés sur demande.\`,
      },
      categoryId, subcategoryId, ...(brandId ? { brandId } : {}),
      industries: INDUSTRIES[categoryId],
      formats: format || packQuantity ? [{ id: \`\${id}-f1\`, value: format || \`Pack de \${packQuantity}\`, ...(packQuantity ? { packQuantity } : {}) }] : [],
      images: [{
        src: \`/img/products/vinto/\${image}\`,
        alt: { en: \`\${nameEn} — product photograph\`, fr: \`\${nameFr} — photographie du produit\` },
        width: 800, height: 800,
      }],
      featured,
      seo: {
        title: { en: nameEn, fr: nameFr },
        description: {
          en: \`\${label.en} available through Catering Tunisia.\`,
          fr: \`\${label.fr.charAt(0).toUpperCase() + label.fr.slice(1)} disponible auprès de Catering Tunisie.\`,
        },
      },
    } satisfies Product;
  },
);

export const IMPORTED_PRODUCT_PROVENANCE: Readonly<Record<string, string>> = Object.fromEntries(
  VINTO_SOURCE.map(([sourceId, , , , , , , , , , , sourceUrl]) => [\`p-vinto-\${sourceId}\`, sourceUrl]),
);
`;

await writeFile(target, generated);
console.log(`Generated ${records.length} Vinto products in ${path.relative(root, target)}`);
console.log(
  Object.fromEntries(
    ['food', 'packaging', 'hygiene'].map((id) => [
      id,
      records.filter((r) => r.categoryId === id).length,
    ]),
  ),
);
