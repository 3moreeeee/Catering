// Exports the catalogue into a JSON seed file for the Spring Boot backend.
//
// The backend is the new source of truth for the catalogue, but the *content*
// (bilingual names, taxonomy, local image paths) was curated in this repository
// and is better than the raw crawl. So the seed is built by joining:
//
//   - the curated Angular catalogue  (src/app/data/products.data.ts) — content
//   - the Vinto crawl snapshot       (tmp/vinto-import/raw-products.json) — price,
//     stock quantity and supplier reference
//
// joined on the numeric Vinto listing id embedded in the curated product id.
//
// Prices are never invented. A curated product with no matching crawl record is
// exported with `price: null`, and the API renders it as "prix sur demande".
//
// Run:  node scripts/export-backend-seed.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PRODUCTS = path.join(ROOT, 'tmp', 'vinto-import', 'raw-products.json');
const OUT_DIR = path.join(ROOT, '..', 'backend', 'src', 'main', 'resources', 'seed');
const OUT_FILE = path.join(OUT_DIR, 'catalog-seed.json');

/**
 * Parses a Vinto price string into a plain decimal string.
 *
 * Vinto renders millimes with a comma as the decimal separator ("13,600 TND"),
 * so the comma cannot be treated as a thousands separator. The value is kept as
 * a string rather than a JS number because it is destined for a BigDecimal with
 * scale 3, and float parsing would introduce exactly the rounding error that
 * three-decimal currency exists to avoid.
 */
function parsePrice(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const match = raw.replace(/\s/g, '').match(/^(\d+)(?:[.,](\d{1,3}))?/);
  if (!match) return null;
  const fraction = (match[2] ?? '').padEnd(3, '0');
  return `${match[1]}.${fraction}`;
}

/**
 * Recovers the Vinto catalogue id used as the join key.
 *
 * Curated ids are namespaced ("p-vinto-471") while the crawl records carry the
 * bare numeric id ("471"), so the digits are the only shared token. A handful of
 * curated rows split one Vinto listing into per-format entries and carry a
 * second group ("p-vinto-353-67"); there the *first* group is the listing id and
 * the second is a pack size. Candidates are therefore tried in order against the
 * crawl rather than assuming a fixed position.
 */
function vintoId(id, known) {
  const groups = String(id).match(/\d+/g) ?? [];
  return groups.find((group) => known.has(group)) ?? null;
}

function localized(value) {
  if (value == null) return { fr: null, en: null };
  if (typeof value === 'string') return { fr: value, en: value };
  return { fr: value.fr ?? null, en: value.en ?? value.fr ?? null };
}

const catalog = await loadCatalog(ROOT);
const rawList = JSON.parse(await readFile(RAW_PRODUCTS, 'utf8'));

const commercial = new Map();
for (const record of rawList) {
  if (!record?.sourceId) continue;
  commercial.set(String(record.sourceId), {
    price: parsePrice(record.private?.price),
    stockQuantity: Number.isFinite(record.private?.quantity) ? record.private.quantity : null,
    reference: record.reference?.trim() || null,
    sourceUrl: record.sourceUrl ?? null,
  });
}

let priced = 0;
const products = catalog.PRODUCTS.map((product) => {
  const trade = commercial.get(vintoId(product.id, commercial)) ?? {};
  if (trade.price) priced += 1;
  const name = localized(product.name);
  const shortDescription = localized(product.shortDescription);
  const description = localized(product.description);

  return {
    sourceId: String(product.id),
    slug: product.slug,
    nameFr: name.fr,
    nameEn: name.en,
    shortDescriptionFr: shortDescription.fr,
    shortDescriptionEn: shortDescription.en,
    descriptionFr: description.fr,
    descriptionEn: description.en,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? null,
    brandId: product.brandId ?? null,
    industries: [...(product.industries ?? [])],
    featured: Boolean(product.featured),
    technicalSheetUrl: product.technicalSheetUrl ?? null,
    needsVerification: Boolean(product.needsVerification),
    seoTitleFr: localized(product.seo?.title).fr,
    seoTitleEn: localized(product.seo?.title).en,
    seoDescriptionFr: localized(product.seo?.description).fr,
    seoDescriptionEn: localized(product.seo?.description).en,
    // Commercial fields, from the crawl only. Null when the crawl has no row.
    price: trade.price ?? null,
    currency: trade.price ? 'TND' : null,
    stockQuantity: trade.stockQuantity ?? null,
    reference: trade.reference ?? null,
    sourceUrl: trade.sourceUrl ?? null,
    formats: (product.formats ?? []).map((format) => ({
      externalId: format.id,
      value: format.value,
      packQuantity: format.packQuantity ?? null,
      sizeBucket: format.sizeBucket ?? null,
      reference: format.reference ?? null,
    })),
    images: (product.images ?? []).map((image, index) => ({
      src: image.src,
      altFr: localized(image.alt).fr,
      altEn: localized(image.alt).en,
      width: image.width,
      height: image.height,
      position: index,
    })),
  };
});

const categories = catalog.CATEGORIES.flatMap((category) => [
  {
    externalId: category.id,
    slug: category.slug,
    nameFr: localized(category.name).fr,
    nameEn: localized(category.name).en,
    parentExternalId: null,
    accent: category.accent ?? null,
    image: category.image ?? null,
    icon: category.icon ?? null,
  },
  ...(category.subcategories ?? []).map((sub) => ({
    externalId: sub.id,
    slug: sub.slug,
    nameFr: localized(sub.name).fr,
    nameEn: localized(sub.name).en,
    parentExternalId: category.id,
    accent: null,
    image: null,
    icon: null,
  })),
]);

const brands = catalog.BRANDS.map((brand) => ({
  externalId: brand.id,
  slug: brand.slug,
  name: brand.name,
  logo: brand.logo ?? null,
  descriptionFr: localized(brand.description).fr,
  descriptionEn: localized(brand.description).en,
  website: brand.website ?? null,
}));

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  OUT_FILE,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), categories, brands, products }, null, 2)}\n`,
  'utf8',
);

console.log(`Seed written to ${path.relative(ROOT, OUT_FILE)}`);
console.log(`  categories : ${categories.length}`);
console.log(`  brands     : ${brands.length}`);
console.log(`  products   : ${products.length} (${priced} priced, ${products.length - priced} without a price)`);
