// =============================================================================
// VINTO ↔ FK CATALOGUE RECONCILIATION
//
// Reads the crawl in tmp/vinto-import/raw-products.json, compares every record
// against the live FK catalogue, and writes a review dataset. It changes
// nothing in the application: its whole output is a report a person reads
// before deciding what may be published.
//
// Classification, in the order the tiers are tried:
//
//   EXACT_DUPLICATE         a reference or an exact normalised name+format
//                           match against an existing FK product
//   EXISTING_VARIANT        same article, different size or pack quantity
//   POSSIBLE_DUPLICATE      similar enough to need a person to look
//   NEW_VERIFIED_PRODUCT    not in FK, maps cleanly onto the FK taxonomy, and
//                           carries enough objective fact to publish
//   NEW_UNVERIFIED_PRODUCT  not in FK, but something material is missing or
//                           inferred — held in staging, never published
//   INSUFFICIENT_DATA       too little was extractable to judge
//   OUT_OF_SCOPE            not a catalogue article, or a family the FK
//                           taxonomy does not have and must not invent
//
// Nothing is ever promoted automatically: POSSIBLE_DUPLICATE and everything
// unverified stay out of the generated dataset by construction.
//
// Usage: node scripts/compare-vinto.mjs
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';
import {
  baseName,
  normalizeBrand,
  normalizeName,
  normalizeReference,
  parseMeasures,
  parsePackQuantity,
  signature,
  signatureSimilarity,
} from './lib/normalize.mjs';
import { NEEDS_NEW_FAMILY, detectBrand, mapTaxonomy } from './lib/taxonomy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'tmp', 'vinto-import');

// -----------------------------------------------------------------------------

const catalog = await loadCatalog(root);
const raw = JSON.parse(await readFile(path.join(OUT, 'raw-products.json'), 'utf8'));

// ---- indexes over the existing catalogue -----------------------------------

const byReference = new Map();
const byName = new Map();
const byBase = new Map();

for (const product of catalog.CURATED_PRODUCTS) {
  const names = [product.name.fr, product.name.en];
  for (const name of names) {
    byName.set(normalizeName(name), product);
    // Signature, not base name: the source writes the brand and the size into
    // the product name and the catalogue does not, so a base-name index misses
    // every real duplicate. See signature() in lib/normalize.mjs.
    const key = signature(name);
    if (!key) continue;
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(product);
  }
  for (const format of product.formats ?? []) {
    if (format.reference) byReference.set(normalizeReference(format.reference), product);
  }
}

const existingSlugs = new Set(catalog.CURATED_PRODUCTS.map((p) => p.slug));
const existingBrandKeys = new Map(catalog.BRANDS.map((b) => [normalizeBrand(b.name), b]));
const validFamilies = new Set(
  catalog.CATEGORIES.flatMap((c) => c.subcategories.map((s) => `${c.id}/${s.id}`)),
);

// ---- classify ---------------------------------------------------------------

const results = [];
const proposedFamilies = new Map();
const brandSightings = new Map();

for (const item of raw) {
  const fr = item.name;
  const measures = parseMeasures(fr);
  const pack = parsePackQuantity(fr);
  const base = signature(fr);
  const normalized = normalizeName(fr);
  const familyKey = normalizeName(item.family ?? '');
  const divisionKey = normalizeName(item.category ?? '');

  // -- taxonomy ---------------------------------------------------------------
  const mapping = mapTaxonomy({ name: fr, family: item.family, division: item.category });
  if (NEEDS_NEW_FAMILY.has(familyKey)) {
    proposedFamilies.set(familyKey, {
      vintoFamily: item.family,
      vintoDivision: item.category,
      note: NEEDS_NEW_FAMILY.get(familyKey),
      products: (proposedFamilies.get(familyKey)?.products ?? 0) + 1,
    });
  }

  // -- brand sighting ---------------------------------------------------------
  // Vinto leaves PrestaShop's manufacturer field empty on every record, so the
  // brand has to be read out of the product name. That is a weaker signal and
  // is treated as one: it groups products for review and never attributes a
  // partnership.
  const brandToken = item.manufacturerName || detectBrand(fr);
  if (brandToken) {
    const key = normalizeBrand(brandToken);
    if (!brandSightings.has(key)) {
      brandSightings.set(key, { name: brandToken, count: 0, urls: [], fromName: !item.manufacturerName });
    }
    const sighting = brandSightings.get(key);
    sighting.count++;
    if (sighting.urls.length < 3) sighting.urls.push(item.sourceUrl);
  }

  // -- duplicate detection ----------------------------------------------------
  let classification = null;
  let match = null;
  let score = 0;
  let reason = '';
  const differs = [];

  // Tier 1 — reference.
  const reference = normalizeReference(item.reference);
  if (reference && byReference.has(reference)) {
    match = byReference.get(reference);
    classification = 'EXACT_DUPLICATE';
    score = 1;
    reason = `reference "${item.reference}" already present on ${match.id}`;
  }

  // Tier 2 — exact normalised name.
  if (!classification && byName.has(normalized)) {
    match = byName.get(normalized);
    classification = 'EXACT_DUPLICATE';
    score = 1;
    reason = 'normalised name is identical';
  }

  // Tier 3 — same article, different size or pack.
  if (!classification && byBase.has(base)) {
    const candidates = byBase.get(base);
    match = candidates[0];
    const existingMeasures = (match.formats ?? []).flatMap((f) => parseMeasures(f.value));
    const sameSize =
      measures.length > 0 &&
      existingMeasures.some((e) => measures.some((m) => m.dimension === e.dimension && Math.abs(m.base - e.base) < 1));
    classification = sameSize ? 'EXACT_DUPLICATE' : 'EXISTING_VARIANT';
    score = 0.95;
    reason = sameSize
      ? 'same article and same measured size'
      : 'same article, different size or pack quantity';
    if (!sameSize) {
      differs.push(
        `size: vinto ${measures.map((m) => m.raw).join(' / ') || '—'} vs fk ${
          existingMeasures.map((m) => m.raw).join(' / ') || '—'
        }`,
      );
    }
  }

  // Tier 4 — fuzzy, on signatures.
  //
  // The thresholds are deliberately generous. Over-flagging costs a reviewer a
  // minute; under-flagging puts a second copy of an existing product into the
  // catalogue, and the brief is explicit that a possible duplicate is never
  // imported automatically. Erring toward review is the cheap mistake.
  if (!classification) {
    let best = null;
    let bestScore = 0;
    for (const product of catalog.CURATED_PRODUCTS) {
      for (const name of [product.name.fr, product.name.en]) {
        const value = signatureSimilarity(fr, name);
        if (value > bestScore) {
          bestScore = value;
          best = product;
        }
      }
    }
    if (bestScore >= 0.55) {
      match = best;
      score = bestScore;
      classification = 'POSSIBLE_DUPLICATE';
      reason =
        bestScore >= 0.72
          ? `signature similarity ${bestScore.toFixed(2)} to ${best.id}`
          : `weak signature similarity ${bestScore.toFixed(2)} to ${best.id} — needs a human`;
    }
  }

  // -- new records ------------------------------------------------------------
  if (!classification) {
    if (!fr || fr.length < 3) {
      classification = 'INSUFFICIENT_DATA';
      reason = 'no usable product name';
    } else if (NEEDS_NEW_FAMILY.has(familyKey)) {
      classification = 'OUT_OF_SCOPE';
      reason = `no FK family for "${item.family}" — ${NEEDS_NEW_FAMILY.get(familyKey)}`;
    } else if (!mapping.categoryId) {
      classification = 'OUT_OF_SCOPE';
      reason = `Vinto division "${item.category ?? '—'}" does not map onto an FK division`;
    } else if (!mapping.subcategoryId) {
      classification = 'NEW_UNVERIFIED_PRODUCT';
      reason = `division ${mapping.categoryId} is clear but the product family is not`;
    } else if (!validFamilies.has(`${mapping.categoryId}/${mapping.subcategoryId}`)) {
      classification = 'OUT_OF_SCOPE';
      reason = `mapped family ${mapping.categoryId}/${mapping.subcategoryId} does not exist`;
    } else if (measures.length === 0 && !pack && !item.reference) {
      // A catalogue record with no size, no pack and no reference cannot be
      // told apart from its own variants later. Held rather than published.
      classification = 'NEW_UNVERIFIED_PRODUCT';
      reason = 'no format, pack quantity or reference — not distinguishable from its variants';
    } else {
      classification = 'NEW_VERIFIED_PRODUCT';
      reason = 'not present in FK, maps onto an existing family, carries an objective format';
    }
  }

  results.push({
    sourceUrl: item.sourceUrl,
    sourceId: item.sourceId,
    vintoName: fr,
    vintoReference: item.reference || null,
    vintoDivision: item.category,
    vintoFamily: item.family,
    manufacturerName: item.manufacturerName || null,
    brandFromName: detectBrand(fr),
    taxonomyVia: mapping.via,
    measures: measures.map((m) => ({ raw: m.raw, value: m.value, unit: m.unit })),
    packQuantity: pack?.quantity ?? null,
    mappedCategoryId: mapping.categoryId,
    mappedSubcategoryId: mapping.subcategoryId,
    classification,
    similarityScore: Number(score.toFixed(3)),
    existingMatchId: match?.id ?? null,
    existingMatchName: match ? match.name.fr : null,
    fieldsThatDiffer: differs,
    proposedAction:
      classification === 'NEW_VERIFIED_PRODUCT'
        ? 'generate candidate record for import'
        : classification === 'NEW_UNVERIFIED_PRODUCT'
          ? 'hold in staging with needsVerification'
          : classification === 'POSSIBLE_DUPLICATE'
            ? 'human review before any import'
            : classification === 'EXISTING_VARIANT'
              ? 'consider adding as a format on the existing product'
              : 'no action',
    reason,
    verification: {
      nameSource: item.provenance?.name ?? null,
      referenceSource: item.provenance?.reference ?? null,
      categorySource: item.provenance?.category ?? null,
      imageRights: 'not confirmed',
      brandRelationship: 'not confirmed',
    },
    collectedAt: item.collectedAt,
  });
}

// ---- brand audit ------------------------------------------------------------

const brandAudit = [...brandSightings.entries()].map(([key, sighting]) => {
  const existing = existingBrandKeys.get(key);
  return {
    name: sighting.name,
    normalized: key,
    productsOnVinto: sighting.count,
    exampleUrls: sighting.urls,
    classification: existing
      ? 'ALREADY_PUBLISHED'
      : // Appearing on a retailer's site is evidence the product exists, not
        // evidence Société Ferid Khemakhem represents the manufacturer.
        'PRODUCT_BRAND_NOT_CONFIRMED_AS_PARTNER',
    existingBrandId: existing?.id ?? null,
    verificationRequired: existing
      ? null
      : 'official manufacturer or distribution document naming Société Ferid Khemakhem',
    mayPublishAsPartner: Boolean(existing),
  };
});

// ---- write ------------------------------------------------------------------

const counts = results.reduce((acc, r) => {
  acc[r.classification] = (acc[r.classification] ?? 0) + 1;
  return acc;
}, {});

const summary = {
  generatedAt: new Date().toISOString(),
  vintoProductsExamined: results.length,
  fkProductsExisting: catalog.CURATED_PRODUCTS.length,
  counts,
  brandsSeen: brandAudit.length,
  brandsAlreadyPublished: brandAudit.filter((b) => b.classification === 'ALREADY_PUBLISHED').length,
  proposedFamilies: [...proposedFamilies.values()],
};

await writeFile(
  path.join(OUT, 'comparison-report.json'),
  JSON.stringify({ summary, results, brandAudit }, null, 2),
);

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const header = [
  'vintoName', 'vintoReference', 'vintoDivision', 'vintoFamily', 'manufacturerName',
  'classification', 'similarityScore', 'existingMatchId', 'existingMatchName',
  'mappedCategoryId', 'mappedSubcategoryId', 'proposedAction', 'reason', 'sourceUrl',
];
await writeFile(
  path.join(OUT, 'comparison-report.csv'),
  [header.join(','), ...results.map((r) => header.map((h) => csvEscape(r[h])).join(','))].join('\n'),
);

console.log(JSON.stringify(summary, null, 2));
console.log(`\nwrote comparison-report.json / .csv to ${path.relative(root, OUT)}`);
