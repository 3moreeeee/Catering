// =============================================================================
// NORMALISATION
//
// Shared by the comparison and import scripts. Every function here is lossless
// at the call site: the caller keeps the original string and stores the
// normalised form alongside it, so provenance survives into the audit dataset.
//
// The rules exist because the two catalogues describe the same things
// differently — "MONIN" vs "Monin", "200gr" vs "200 g", "LES 50" vs "lot de 50"
// — and a comparison that does not account for that either misses real
// duplicates or invents false ones.
// =============================================================================

/** Strips accents so "Hygiène" and "Hygiene" compare equal. */
export function deaccent(value) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * The key used for name comparison: lower case, unaccented, apostrophes and
 * punctuation flattened to spaces, runs of space collapsed.
 */
export function normalizeName(value) {
  return deaccent(String(value ?? ''))
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Brand keys ignore case, accents, punctuation and legal suffixes. */
export function normalizeBrand(value) {
  return normalizeName(value)
    .replace(/\b(sarl|sa|srl|spa|gmbh|ltd|llc|inc|co|company|group|groupe)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** References ignore case, spaces and separators: "MB-350" === "mb 350". */
export function normalizeReference(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// -----------------------------------------------------------------------------
// Quantities and formats
// -----------------------------------------------------------------------------

/** Canonical unit for a raw unit token. */
const UNIT_ALIASES = new Map([
  ['ml', 'ml'], ['millilitre', 'ml'], ['millilitres', 'ml'],
  ['cl', 'cl'], ['centilitre', 'cl'], ['centilitres', 'cl'],
  ['l', 'l'], ['lt', 'l'], ['litre', 'l'], ['litres', 'l'],
  ['g', 'g'], ['gr', 'g'], ['gramme', 'g'], ['grammes', 'g'], ['grs', 'g'],
  ['kg', 'kg'], ['kilo', 'kg'], ['kilos', 'kg'], ['kilogramme', 'kg'],
  ['mm', 'mm'], ['cm', 'cm'], ['m', 'm'],
  ['cc', 'ml'], ['oz', 'oz'],
]);

/** Everything expressed in a base unit, so 1 L and 1000 ml compare equal. */
const TO_BASE = { ml: 1, cl: 10, l: 1000, g: 1, kg: 1000, mm: 1, cm: 10, m: 1000, oz: 29.5735 };
const DIMENSION = { ml: 'volume', cl: 'volume', l: 'volume', g: 'mass', kg: 'mass', oz: 'volume', mm: 'length', cm: 'length', m: 'length' };

/**
 * Pulls every measurement out of a string.
 *
 * Returns objects carrying the original text so nothing is lost:
 *   "Moutarde forte de Dijon 370gr" → [{ raw: '370gr', value: 370, unit: 'g', base: 370 }]
 */
export function parseMeasures(value) {
  const text = deaccent(String(value ?? '')).toLowerCase().replace(/,(\d)/g, '.$1');
  const out = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(ml|millilitres?|cl|centilitres?|lt|litres?|l|grammes?|grs|gr|g|kilogrammes?|kilos?|kg|mm|cm|m|cc|oz)\b/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const unit = UNIT_ALIASES.get(match[2]);
    if (!unit) continue;
    const amount = Number(match[1]);
    out.push({
      raw: match[0].trim(),
      value: amount,
      unit,
      dimension: DIMENSION[unit],
      base: amount * TO_BASE[unit],
    });
  }
  return out;
}

/**
 * Pack quantity, from the several ways both catalogues express it.
 *
 *   "LES 50" · "50 pièces" · "lot de 50" · "x50" · "boîte de 50" · "par 50"
 */
export function parsePackQuantity(value) {
  const text = deaccent(String(value ?? '')).toLowerCase();
  const patterns = [
    /\bles\s+(\d+)\b/,
    /\blot\s+de\s+(\d+)\b/,
    /\bbo[iî]te\s+de\s+(\d+)\b/,
    /\bpaquet\s+de\s+(\d+)\b/,
    /\bsachet\s+de\s+(\d+)\b/,
    /\bpar\s+(\d+)\b/,
    /\bx\s?(\d+)\b/,
    /\b(\d+)\s*(?:pi[eè]ces?|pcs?|unit[eé]s?)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { raw: match[0].trim(), quantity: Number(match[1]) };
  }
  return null;
}

/**
 * The name with its measurements and pack quantity removed, which is what
 * actually identifies the article. "Barbecue Mayor 350 ml" → "barbecue mayor".
 */
export function baseName(value) {
  let text = deaccent(String(value ?? '')).toLowerCase();
  for (const measure of parseMeasures(text)) text = text.replace(measure.raw, ' ');
  const pack = parsePackQuantity(text);
  if (pack) text = text.replace(pack.raw, ' ');
  return text
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// -----------------------------------------------------------------------------
// Similarity
// -----------------------------------------------------------------------------

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** 0…1, combining edit distance with token overlap so word order does not matter. */
export function similarity(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const edit = 1 - distance / Math.max(left.length, right.length);

  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const shared = [...leftTokens].filter((t) => rightTokens.has(t)).length;
  const jaccard = shared / (leftTokens.size + rightTokens.size - shared);

  return Number((edit * 0.45 + jaccard * 0.55).toFixed(4));
}

/** Slug in the shape the existing catalogue uses. */
export function toSlug(value) {
  return deaccent(String(value ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

// -----------------------------------------------------------------------------
// SIGNATURES
//
// The comparison key that actually identifies an article.
//
// Raw name similarity was hopeless here: "Sirop Mojito Mint Monin 25cl" scored
// 0.44 against the catalogue's "Sirop mojito menthe" — the same product —
// because the brand token, the size token and the French articles outweighed
// the two words that carry the meaning. A signature strips everything that is
// not distinguishing and sorts what is left, so word order stops mattering too.
// -----------------------------------------------------------------------------

/** Words that appear in half the catalogue and identify nothing. */
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'au', 'aux',
  'avec', 'sans', 'pour', 'a', 'saveur', 'saveurs', 'gout', 'the', 'of', 'with',
  'pieces', 'piece', 'pcs', 'boites', 'boite', 'rame', 'feuilles', 'sachet',
]);

/**
 * Words that mean the same article in the two catalogues.
 *
 * Deliberately tiny and deliberately explicit. This is a translation table, and
 * every entry is a judgement that two words denote the same thing in a
 * catalogue context — so it is kept to terms that actually recur across both
 * sources and can be checked at a glance. It is not a general dictionary and
 * must not become one.
 */
const SYNONYMS = new Map([
  ['syrup', 'sirop'],
  ['mint', 'menthe'],
  ['cup', 'gobelet'],
  ['straw', 'paille'],
  ['glove', 'gant'],
  ['gloves', 'gant'],
  ['gants', 'gant'],
  ['mustard', 'moutarde'],
  ['sugar', 'sucre'],
  ['cane', 'canne'],
  ['lime', 'citron'],
  ['vert', 'vert'],
  ['strawberry', 'fraise'],
  ['raspberry', 'framboise'],
  ['banana', 'banane'],
  ['coconut', 'coco'],
  ['hazelnut', 'noisette'],
  ['caramel', 'caramel'],
  ['chocolate', 'chocolat'],
  ['vanilla', 'vanille'],
  ['coffee', 'cafe'],
  ['fork', 'fourchette'],
  ['knife', 'couteau'],
  ['spoon', 'cuillere'],
  ['tray', 'barquette'],
  ['bowl', 'bol'],
  ['mask', 'masque'],
  ['apron', 'tablier'],
  ['paper', 'papier'],
  ['wooden', 'bois'],
  ['wood', 'bois'],
  ['plastic', 'plastique'],
  ['black', 'noir'],
  ['white', 'blanc'],
  // The curated catalogue stores several articles under their English name and
  // the source lists the same article in French. Without these the signatures
  // never meet and a genuine duplicate is imported a second time — which is
  // exactly what happened with "Polycarbonate Gastronorm Container" and
  // "Bac gastronorme … en polycarbonate".
  ['gastronorm', 'gastronorme'],
  ['container', 'bac'],
  ['lid', 'couvercle'],
  ['board', 'planche'],
  ['pick', 'pique'],
  ['doily', 'dentelle'],
  ['hairnet', 'coiffe'],
  ['overshoe', 'surchaussure'],
  ['apron', 'tablier'],
  ['coat', 'blouse'],
  ['cap', 'calot'],
  ['roll', 'rouleau'],
  ['sheet', 'feuille'],
  ['bowl', 'bol'],
  ['plate', 'assiette'],
  ['pump', 'pompe'],
  ['vinegar', 'vinaigre'],
  ['film', 'film'],
  ['bag', 'poche'],
  ['case', 'caissette'],
]);

/** Brand names are identity, not description — they never distinguish articles. */
const BRAND_WORDS = new Set([
  'monin', 'martellato', 'plastport', 'dijona', 'mayor', 'varvello', 'emporium',
  'lilas', 'lamaa', 'delicio', 'barka',
]);

/**
 * Sorted, de-branded, de-sized, stop-worded token set.
 * "Sirop Mojito Mint Monin 25cl" → "menthe mojito sirop"
 */
export function signature(value) {
  const tokens = baseName(value)
    .split(' ')
    .map((t) => SYNONYMS.get(t) ?? t)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !BRAND_WORDS.has(t));
  return [...new Set(tokens)].sort().join(' ');
}

/** Similarity between two signatures rather than two raw names. */
export function signatureSimilarity(a, b) {
  return similarity(signature(a), signature(b));
}
