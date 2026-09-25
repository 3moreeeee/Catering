// =============================================================================
// VINTO IMPORT — candidate generation
//
// Turns the reconciliation report into a generated Angular data module. It is
// the only script that writes into src/, and it is deliberately narrow about
// what it will write.
//
// WHAT IT PUBLISHES
//
// Only records the comparison classified NEW_VERIFIED_PRODUCT: not already in
// the FK catalogue, mapping onto an existing FK division and family, and
// carrying an objective format, pack quantity or reference. Everything else —
// possible duplicates, anything unverified, anything whose family the FK
// taxonomy does not have — is written to the staging dataset in
// tmp/vinto-import/ and never reaches the application.
//
// WHAT IT REFUSES TO DO
//
//   - No price and no stock. The FK site is an enquiry catalogue.
//   - No brand attribution unless the brand is already a published FK partner.
//     A manufacturer name appearing on a retailer's site is evidence the
//     product exists, not evidence Société Ferid Khemakhem represents it.
//   - No copied marketing copy. Descriptions are composed here from the
//     objective facts (division, family, format, pack quantity) using the same
//     sentence patterns the existing catalogue uses.
//   - No image is downloaded or hotlinked. Every generated record points at the
//     existing placeholder until the rights review clears a real photograph.
//   - No invented origin, certification or specification.
//
// Usage:
//   node scripts/import-vinto-catalog.mjs --dry-run
//   node scripts/import-vinto-catalog.mjs
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';
import { toSlug } from './lib/normalize.mjs';
import { translateName } from './lib/lexicon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'tmp', 'vinto-import');
const TARGET = path.join(root, 'src', 'app', 'data', 'products.imported.data.ts');
const DRY_RUN = process.argv.includes('--dry-run');

const PLACEHOLDER = {
  src: '/img/products/placeholder.svg',
  width: 800,
  height: 800,
};

// -----------------------------------------------------------------------------
// COPY
//
// Composed from facts, in the register the existing catalogue already uses. The
// source's own sentences are never reused: they are marketing copy owned by
// someone else, and several contain claims we cannot stand behind.
// -----------------------------------------------------------------------------

const DIVISION_COPY = {
  food: {
    fr: { noun: 'référence agro-alimentaire', division: 'division agro-alimentaire' },
    en: { noun: 'food and beverage reference', division: 'food and beverage division' },
  },
  packaging: {
    fr: { noun: 'article d’emballage professionnel', division: 'division emballage professionnel' },
    en: { noun: 'professional packaging item', division: 'professional packaging division' },
  },
  hygiene: {
    fr: { noun: 'consommable d’hygiène', division: 'division hygiène et jetable' },
    en: { noun: 'hygiene consumable', division: 'hygiene and disposables division' },
  },
};

function formatSentence(record, locale) {
  const bits = [];
  if (record.measures.length) {
    bits.push(record.measures.map((m) => `${m.value} ${m.unit}`).join(' · '));
  }
  if (record.packQuantity) {
    bits.push(locale === 'fr' ? `conditionnement par ${record.packQuantity}` : `packs of ${record.packQuantity}`);
  }
  return bits.join(' — ');
}

function shortDescription(record, locale) {
  const copy = DIVISION_COPY[record.mappedCategoryId][locale];
  const format = formatSentence(record, locale);
  return locale === 'fr'
    ? `${capitalize(copy.noun)} distribué par la Société Ferid Khemakhem${format ? ` — ${format}` : ''}.`
    : `${capitalize(copy.noun)} distributed by Société Ferid Khemakhem${format ? ` — ${format}` : ''}.`;
}

function description(record, locale) {
  const copy = DIVISION_COPY[record.mappedCategoryId][locale];
  const format = formatSentence(record, locale);
  if (locale === 'fr') {
    return (
      `${record.name.fr} fait partie de notre ${copy.division}.` +
      (format ? ` Format : ${format}.` : '') +
      ' Importé et distribué pour les cuisines professionnelles et la restauration.' +
      ' Les spécifications techniques complètes, les quantités par colis et les délais' +
      ' sont disponibles auprès de notre équipe commerciale sur demande.'
    );
  }
  return (
    `${record.name.en} is part of our ${copy.division}.` +
    (format ? ` Format: ${format}.` : '') +
    ' Imported and distributed for professional kitchens and food service.' +
    ' Full technical specifications, pack quantities and lead times are available' +
    ' from our sales team on request.'
  );
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Tidies the source's own name for the French field.
 *
 * The brief permits correcting obvious source typography in our own content,
 * and only there — the provenance dataset keeps the original spelling. This
 * strips the trailing full stops and doubled spaces that PrestaShop's catalogue
 * has collected ("Pompe 10ml MONIN." → "Pompe 10ml MONIN").
 */
function tidyFrench(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/[.\s]+$/, '')
    .trim();
}

const INDUSTRIES = {
  food: ['restaurants', 'hotels', 'retail'],
  packaging: ['restaurants', 'hotels', 'food-production', 'retail'],
  hygiene: ['restaurants', 'hotels', 'healthcare', 'food-production'],
};

// -----------------------------------------------------------------------------

const catalog = await loadCatalog(root);
const report = JSON.parse(await readFile(path.join(OUT, 'comparison-report.json'), 'utf8'));

const publishedBrandIds = new Set(catalog.BRANDS.map((b) => b.id));
const validFamilies = new Set(
  catalog.CATEGORIES.flatMap((c) => c.subcategories.map((s) => `${c.id}/${s.id}`)),
);
const takenSlugs = new Set(catalog.CURATED_PRODUCTS.map((p) => p.slug));
const takenIds = new Set(catalog.CURATED_PRODUCTS.map((p) => p.id));

const candidates = report.results.filter((r) => r.classification === 'NEW_VERIFIED_PRODUCT');
const staging = report.results.filter((r) =>
  ['NEW_UNVERIFIED_PRODUCT', 'POSSIBLE_DUPLICATE', 'INSUFFICIENT_DATA', 'OUT_OF_SCOPE'].includes(
    r.classification,
  ),
);

const generated = [];
const rejected = [];
/** Candidates pulled out of the import and added to the review dataset. */
const held = [];
/** Brands seen on a candidate that FK does not publish. Never attributed. */
const unattributedBrands = new Map();
const counters = new Map();
const existingCatalogueSlugs = new Set(catalog.CURATED_PRODUCTS.map((p) => p.slug));

for (const record of candidates) {
  const measures = record.measures ?? [];

  // -- validation, before anything is written --------------------------------
  const family = `${record.mappedCategoryId}/${record.mappedSubcategoryId}`;
  if (!validFamilies.has(family)) {
    rejected.push({ name: record.vintoName, reason: `family ${family} does not exist` });
    continue;
  }

  const nameFr = tidyFrench(record.vintoName);
  const translated = translateName(record.vintoName);
  const nameEn = translated.english;
  if (!nameFr || !nameEn) {
    rejected.push({ name: record.vintoName, reason: 'incomplete localized name' });
    continue;
  }
  // The lexicon could not account for every word. The record still publishes —
  // the English name is readable — but it is flagged so a human finishes the
  // translation rather than the machine guessing at trade vocabulary.
  const translationIncomplete = translated.residue.length > 0;

  let slug = toSlug(nameFr);
  if (!slug) {
    rejected.push({ name: nameFr, reason: 'slug could not be derived' });
    continue;
  }
  if (takenSlugs.has(slug)) {
    // Two different articles the source gives the same name. The five colour
    // variants of "Planche à découper à code couleur 30cmx60cmx2cm" are a real
    // example: the colour is the only thing that distinguishes them and it is
    // not in the name. Making up a suffix would invent a distinction, and
    // dropping them silently would lose five products — so they are held for
    // review with the collision named.
    const collidesWithCatalogue = existingCatalogueSlugs.has(slug);
    held.push({
      ...record,
      classification: 'POSSIBLE_DUPLICATE',
      reason: collidesWithCatalogue
        ? `slug "${slug}" already belongs to a catalogue product`
        : `slug "${slug}" is shared with another source record — the distinguishing ` +
          'attribute (colour, variant) is not present in the name',
      proposedAction: 'human review before any import',
    });
    continue;
  }
  takenSlugs.add(slug);

  const index = (counters.get(record.mappedCategoryId) ?? 0) + 1;
  counters.set(record.mappedCategoryId, index);
  const id = `p-${record.mappedCategoryId}-v${String(index).padStart(3, '0')}`;
  if (takenIds.has(id)) {
    rejected.push({ name: nameFr, reason: `id ${id} collides` });
    continue;
  }
  takenIds.add(id);

  const detected = record.brandFromName ?? record.manufacturerName ?? null;
  const brandId = detected && publishedBrandIds.has(toSlug(detected)) ? toSlug(detected) : null;
  if (detected && !brandId) {
    unattributedBrands.set(detected, (unattributedBrands.get(detected) ?? 0) + 1);
  }

  const withNames = { ...record, name: { fr: nameFr, en: nameEn }, measures };

  const formats = [];
  const formatValue = formatSentence(withNames, 'fr');
  if (formatValue) {
    formats.push({
      id: `${id}-f1`,
      value: measures.map((m) => `${m.value} ${m.unit}`).join(' / ') || `${record.packQuantity}`,
      ...(record.packQuantity ? { packQuantity: record.packQuantity } : {}),
    });
  }

  generated.push({
    id,
    slug,
    name: { en: nameEn, fr: nameFr },
    shortDescription: { en: shortDescription(withNames, 'en'), fr: shortDescription(withNames, 'fr') },
    description: { en: description(withNames, 'en'), fr: description(withNames, 'fr') },
    categoryId: record.mappedCategoryId,
    subcategoryId: record.mappedSubcategoryId,
    // Brand is attributed ONLY when the manufacturer is already a published FK
    // partner. Everything else is recorded in the brand audit for verification.
    //
    // The brand comes from the product name, because Vinto leaves PrestaShop's
    // manufacturer field empty on all 188 records. Reading manufacturerName
    // here attributed nothing at all — including for Monin, which FK already
    // publishes and which appears in 40 of these product names.
    ...(brandId ? { brandId } : {}),
    industries: INDUSTRIES[record.mappedCategoryId],
    formats,
    images: [
      {
        src: PLACEHOLDER.src,
        alt: {
          en: `${nameEn} — product image pending`,
          fr: `${nameFr} — photographie du produit à venir`,
        },
        width: PLACEHOLDER.width,
        height: PLACEHOLDER.height,
      },
    ],
    featured: false,
    ...(translationIncomplete ? { needsVerification: true } : {}),
    seo: {
      title: { en: nameEn, fr: nameFr },
      description: {
        en: shortDescription(withNames, 'en'),
        fr: shortDescription(withNames, 'fr'),
      },
    },
    provenance: {
      source: 'vinto.tn',
      sourceUrl: record.sourceUrl,
      collectedAt: record.collectedAt,
    },
  });
}

// -----------------------------------------------------------------------------
// Emit
// -----------------------------------------------------------------------------

const literal = (value) => JSON.stringify(value, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');

const header = `// GENERATED by scripts/import-vinto-catalog.mjs — do not edit by hand.
//
// Catalogue references reconciled against the public vinto.tn listing on
// ${new Date().toISOString().slice(0, 10)}. Every record here was classified
// NEW_VERIFIED_PRODUCT by scripts/compare-vinto.mjs, meaning it is absent from
// the curated catalogue, maps onto an existing FK division and family, and
// carries an objective format, pack quantity or reference.
//
// What these records deliberately do NOT contain:
//
//   - a price or a stock figure — this is an enquiry catalogue;
//   - a brand attribution, unless the manufacturer is already a published FK
//     partner. A name on a retailer's shelf is not a distribution agreement;
//   - any sentence taken from the source. The descriptions are composed from
//     the division, family and format, in the register the curated records use;
//   - a photograph. Every record points at the placeholder until image rights
//     are confirmed — see tmp/vinto-import/image-rights-review.csv;
//   - an origin, certification or specification that was not published.
//
// Regenerate with: node scripts/import-vinto-catalog.mjs
`;

const body = `${header}
import { Product } from '../shared/models/catalog.model';

export const IMPORTED_PRODUCTS: readonly Product[] = ${literal(
  generated.map(({ provenance, ...rest }) => rest),
)};

/** Where each imported record came from. Not rendered; kept for audit. */
export const IMPORTED_PRODUCT_PROVENANCE: Readonly<
  Record<string, { readonly source: string; readonly sourceUrl: string; readonly collectedAt: string }>
> = ${literal(Object.fromEntries(generated.map((p) => [p.id, p.provenance])))};
`;

await writeFile(
  path.join(OUT, 'staging-products.json'),
  JSON.stringify([...staging, ...held], null, 2),
);
await writeFile(
  path.join(OUT, 'unattributed-brands.json'),
  JSON.stringify(
    [...unattributedBrands.entries()].map(([name, products]) => ({
      name,
      products,
      note:
        'Seen in a product name on vinto.tn. Not published as an FK partner: a ' +
        'name on a retailer\'s shelf is not a distribution agreement.',
    })),
    null,
    2,
  ),
);
await writeFile(path.join(OUT, 'import-rejected.json'), JSON.stringify(rejected, null, 2));

if (DRY_RUN) {
  console.log('DRY RUN — nothing written to src/');
} else {
  await writeFile(TARGET, body);
  console.log(`wrote ${path.relative(root, TARGET)}`);
}

console.log(
  JSON.stringify(
    {
      candidates: candidates.length,
      generated: generated.length,
      rejected: rejected.length,
      heldForReview: held.length,
      heldInStaging: staging.length + held.length,
      brandsSeenButNotAttributed: [...unattributedBrands.keys()],
      englishNamesNeedingAHuman: generated.filter((p) => p.needsVerification).length,
      brandsAttributed: generated.filter((p) => p.brandId).length,
      allUsePlaceholderImage: generated.every((p) => p.images[0].src === PLACEHOLDER.src),
    },
    null,
    2,
  ),
);
