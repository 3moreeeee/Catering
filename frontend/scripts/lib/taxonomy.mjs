// =============================================================================
// VINTO → FK TAXONOMY
//
// Two layers, applied in order.
//
//   1. NAME_RULES  — for the families that are genuinely mixed on the source.
//      "Consommables Pour Cuisine Et Restauration" holds hairnets, masks and
//      overshoes; "Verrines Et Piques" holds two different FK families;
//      "Consommables Pâtisserie" holds baking cases, baking paper and doilies,
//      and FK files doilies under hygiene. A family-level mapping would put all
//      of those in one wrong place, so the product name decides.
//
//   2. FAMILY_RULES — everything else, by the source's own family name.
//
// A family with no FK equivalent is NOT invented. It is reported as a proposal
// and its products are held out of the import until someone decides.
//
// Every mapping here is a judgement about where an article belongs, not a fact
// about the article. They are listed explicitly, in one place, so they can be
// reviewed and argued with.
// =============================================================================

import { normalizeName } from './normalize.mjs';

/** Applied to the product name before the family is consulted. */
export const NAME_RULES = [
  // -- hygiene, filed under a mixed "kitchen consumables" family on the source
  { match: /\b(coiffe|charlotte|casquette|calot)\b/, categoryId: 'hygiene', subcategoryId: 'headwear' },
  { match: /\bmasque/, categoryId: 'hygiene', subcategoryId: 'masks' },
  { match: /\bsurchaussure/, categoryId: 'hygiene', subcategoryId: 'footwear' },
  { match: /\b(tablier|manchette)/, categoryId: 'hygiene', subcategoryId: 'aprons-sleeves' },
  { match: /\bgants?\b/, categoryId: 'hygiene', subcategoryId: 'gloves' },
  { match: /\b(essuie tout|essuie main|bobine|papier toilette)\b/, categoryId: 'hygiene', subcategoryId: 'paper-wiping' },
  // FK files doilies under hygiene, while the source sells them as a pastry
  // consumable. FK's own taxonomy wins.
  { match: /\bpapier dentelle\b/, categoryId: 'hygiene', subcategoryId: 'doilies' },

  // A chef's toque is headwear; a disposable coat is filed with aprons and
  // sleeves, which is where FK keeps protective garments.
  { match: /\btoque\b/, categoryId: 'hygiene', subcategoryId: 'headwear' },
  { match: /\bblouses?\b/, categoryId: 'hygiene', subcategoryId: 'aprons-sleeves' },

  // -- packaging
  { match: /\bpique/, categoryId: 'packaging', subcategoryId: 'picks' },
  { match: /\b(gobelet|verre)\b/, categoryId: 'packaging', subcategoryId: 'glassware' },
  { match: /\b(paille|pailles)\b/, categoryId: 'packaging', subcategoryId: 'straws' },
  { match: /\bpapier cuisson\b/, categoryId: 'packaging', subcategoryId: 'films-papers' },
  { match: /\b(caissette|caissettes)\b/, categoryId: 'packaging', subcategoryId: 'verrines' },
  { match: /\bverrine/, categoryId: 'packaging', subcategoryId: 'verrines' },

  // -- food
  { match: /\bmoutarde\b/, categoryId: 'food', subcategoryId: 'condiments' },
  // Three syrup records lost their breadcrumb on the source and arrived with no
  // division at all. The name is unambiguous, so it decides.
  { match: /\b(sirop|concentre|frappe|puree)\b/, categoryId: 'food', subcategoryId: 'syrups' },
];

/** Applied to the source's family name when no name rule matched. */
export const FAMILY_RULES = new Map([
  // food
  ['conserves', { categoryId: 'food', subcategoryId: 'canned' }],
  ['sauces et condiments', { categoryId: 'food', subcategoryId: 'sauces-dressings' }],
  ['sauces', { categoryId: 'food', subcategoryId: 'sauces-dressings' }],
  ['sauces asiatiques', { categoryId: 'food', subcategoryId: 'sauces-dressings' }],
  ['vinaigre creme de balsamique', { categoryId: 'food', subcategoryId: 'sauces-dressings' }],
  ['sirops', { categoryId: 'food', subcategoryId: 'syrups' }],
  ['purees', { categoryId: 'food', subcategoryId: 'syrups' }],
  ['frappes', { categoryId: 'food', subcategoryId: 'syrups' }],
  ['cafes', { categoryId: 'food', subcategoryId: 'coffee' }],

  // packaging
  ['emballages alimentaires', { categoryId: 'packaging', subcategoryId: 'trays-containers' }],
  ['contenant alimentaire', { categoryId: 'packaging', subcategoryId: 'trays-containers' }],
  ['bac en polycarbonate', { categoryId: 'packaging', subcategoryId: 'trays-containers' }],
  ['bac en polypropylene', { categoryId: 'packaging', subcategoryId: 'trays-containers' }],
  ['verre et gobelets', { categoryId: 'packaging', subcategoryId: 'glassware' }],
  ['verrines et piques', { categoryId: 'packaging', subcategoryId: 'verrines' }],
  ['consommables patisserie', { categoryId: 'packaging', subcategoryId: 'films-papers' }],
  ['couverts', { categoryId: 'packaging', subcategoryId: 'cutlery-serving' }],
  ['plateau de service', { categoryId: 'packaging', subcategoryId: 'cutlery-serving' }],
  ['ustensiles de cuisine', { categoryId: 'packaging', subcategoryId: 'equipment' }],
  ['planche a decouper', { categoryId: 'packaging', subcategoryId: 'equipment' }],
  ['pelle a glacons', { categoryId: 'packaging', subcategoryId: 'equipment' }],
  // Pumps, dosers, muddlers and bottle racks. FK has no bar-equipment family;
  // `equipment` under packaging is the closest honest home for hardware.
  ['accessoires barista', { categoryId: 'packaging', subcategoryId: 'equipment' }],
  ['pailles', { categoryId: 'packaging', subcategoryId: 'straws' }],

  // hygiene
  ['gants', { categoryId: 'hygiene', subcategoryId: 'gloves' }],
  ['papier cellulose', { categoryId: 'hygiene', subcategoryId: 'paper-wiping' }],
]);

/** Division fallback when only the top-level breadcrumb is usable. */
export const DIVISION_RULES = new Map([
  ['agro alimentaire', 'food'],
  ['monin', 'food'],
  ['emballage', 'packaging'],
  ['hygiene', 'hygiene'],
]);

/**
 * Source families with no FK equivalent. Products land OUT_OF_SCOPE and the
 * family is reported as a proposal — adding one is a business decision.
 */
export const NEEDS_NEW_FAMILY = new Map([
  [
    'detergent',
    'Cleaning chemicals. The hygiene division covers disposables only; there is ' +
      'no detergent family, and creating one commits FK to a product line.',
  ],
]);

/**
 * Brand names that appear inside product names on the source.
 *
 * Detecting a brand here is NOT a claim that Société Ferid Khemakhem represents
 * it. It only lets the audit group products and tell the reviewer which
 * manufacturers would need a distribution agreement before they could be shown
 * as partners. Only brands already published in brands.data.ts are ever
 * attributed to a product.
 */
export const BRAND_TOKENS = [
  'monin',
  'martellato',
  'plastport',
  'dijona',
  'mayor',
  'varvello',
  'emporium',
  'lilas',
  'lamaa',
];

export function detectBrand(name) {
  const normalized = normalizeName(name);
  return BRAND_TOKENS.find((token) => new RegExp(`\\b${token}\\b`).test(normalized)) ?? null;
}

/** Resolves a source record onto the FK taxonomy. */
export function mapTaxonomy({ name, family, division }) {
  const normalizedName = normalizeName(name);
  for (const rule of NAME_RULES) {
    if (rule.match.test(normalizedName)) {
      return { categoryId: rule.categoryId, subcategoryId: rule.subcategoryId, via: 'name' };
    }
  }

  const familyKey = normalizeName(family ?? '');
  if (NEEDS_NEW_FAMILY.has(familyKey)) {
    return { categoryId: null, subcategoryId: null, via: 'needs-new-family', familyKey };
  }

  const byFamily = FAMILY_RULES.get(familyKey);
  if (byFamily) return { ...byFamily, via: 'family' };

  const categoryId = DIVISION_RULES.get(normalizeName(division ?? '')) ?? null;
  return { categoryId, subcategoryId: null, via: categoryId ? 'division' : 'none' };
}
