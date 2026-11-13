// Rebuilds src/app/data/categories.data.ts from the backend taxonomy file,
// backend/src/main/resources/catalog/taxonomy.json — the single source of the
// category tree, which the API also applies to the database at startup.
//
//   node scripts/generate-categories.mjs        (from frontend/)
//
// Division descriptions and SEO texts live here; ids, names and the tree come
// from the JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tax = JSON.parse(
  readFileSync(resolve(root, '../backend/src/main/resources/catalog/taxonomy.json'), 'utf8'),
);
const target = resolve(root, 'src/app/data/categories.data.ts');

const q = (s) => JSON.stringify(s);

function sub(node, division, indent) {
  const pad = ' '.repeat(indent);
  let s =
    `${pad}{\n${pad}  id: ${q(node.id)},\n${pad}  slug: ${q(node.id)},\n` +
    `${pad}  categoryId: ${q(division)},\n${pad}  name: { en: ${q(node.nameEn)}, fr: ${q(node.nameFr)} },\n`;
  if (node.children?.length) {
    s += `${pad}  children: [\n${node.children.map((c) => sub(c, division, indent + 4)).join('')}${pad}  ],\n`;
  }
  return `${s}${pad}},\n`;
}

const META = {
  food: {
    name: ['Food', 'Agro-alimentaire'],
    short: ['Food', 'Agro-alimentaire'],
    description: [
      'Balsamic vinegar and glaze, sauces, condiments and canned goods for professional kitchens and retail.',
      'Vinaigre et crème de balsamique, sauces, condiments et conserves pour les cuisines professionnelles et la distribution.',
    ],
    long: [
      'Our food division supplies the ingredients professional kitchens work with every day — balsamic vinegar and glaze, ketchup, mayonnaise, mustard, barbecue and Asian sauces, and canned vegetables in institutional formats. Suppliers are selected against European and international standards.',
      'Notre division agro-alimentaire fournit les ingrédients avec lesquels travaillent quotidiennement les cuisines professionnelles : vinaigre et crème de balsamique, ketchup, mayonnaise, moutarde, sauces barbecue et asiatiques, et conserves de légumes en formats collectivité. Nos fournisseurs sont sélectionnés selon les normes européennes et internationales.',
    ],
    image: '/img/categories/food.jpg',
    icon: 'bottle',
    seoTitle: [
      'Food Products — Wholesale Distribution Tunisia',
      'Produits agro-alimentaires — Distribution en gros Tunisie',
    ],
    seoDescription: [
      'Balsamic vinegar, sauces, condiments and canned goods for restaurants, hotels and retail across Tunisia. Importer since 1985.',
      'Vinaigre balsamique, sauces, condiments et conserves pour la restauration, l’hôtellerie et la distribution en Tunisie. Importateur depuis 1985.',
    ],
  },
  packaging: {
    name: ['Packaging', 'Emballage'],
    short: ['Packaging', 'Emballage'],
    description: [
      'Verrines and picks, cups and glasses, kitchen utensils, straws, food packaging, cutlery and pastry supplies.',
      'Verrines et piques, verres et gobelets, ustensiles de cuisine, pailles, emballages alimentaires, couverts et consommables pâtisserie.',
    ],
    long: [
      'Our professional-packaging universe: single-portion verrines and decorative picks, PET, paper, EPS and polycarbonate cups and glasses, kitchen utensils, straws, kraft, cardboard and EPS food packaging, cling film and foil, cutlery and pastry supplies — the working materials of professional presentation and food handling.',
      'Notre univers d’emballage professionnel : verrines monoportion et piques décoratifs, gobelets et verres en PET, carton, EPS et polycarbonate, ustensiles de cuisine, pailles, emballages alimentaires en kraft, carton et EPS, film étirable et papier aluminium, couverts et consommables pâtisserie — les matériaux de travail de la présentation professionnelle et de la manipulation alimentaire.',
    ],
    image: '/img/categories/packaging.jpg',
    icon: 'container',
    seoTitle: [
      'Packaging — Verrines, Cups & Food Packaging Tunisia',
      'Emballage — Verrines, gobelets et emballages alimentaires Tunisie',
    ],
    seoDescription: [
      'Verrines, picks, cups and glasses, straws, food packaging, cutlery and pastry supplies for professional kitchens in Tunisia.',
      'Verrines, piques, verres et gobelets, pailles, emballages alimentaires, couverts et consommables pâtisserie pour les cuisines professionnelles en Tunisie.',
    ],
  },
  monin: {
    name: ['MONIN', 'MONIN'],
    short: ['MONIN', 'MONIN'],
    description: [
      'Syrups, sauces, fruit purées, frappés and barista accessories for creative beverage service.',
      'Sirops, sauces, purées de fruits, frappés et accessoires barista pour la création de boissons.',
    ],
    long: [
      'A dedicated MONIN universe for bars, coffee shops, hotels and restaurants: syrups, sauces, fruit purées, frappés and barista accessories, available through one commercial contact.',
      'Un univers MONIN dédié aux bars, coffee-shops, hôtels et restaurants : sirops, sauces, purées de fruits, frappés et accessoires barista, accessibles auprès d’un seul interlocuteur commercial.',
    ],
    image: '/img/video-stills/monin-fraicheur.jpg',
    icon: 'bottle',
    seoTitle: [
      'MONIN Tunisia — Syrups, Sauces, Purées & Barista Accessories',
      'MONIN Tunisie — Sirops, sauces, purées et accessoires barista',
    ],
    seoDescription: [
      'Explore the MONIN professional range distributed in Tunisia: syrups, sauces, fruit purées, frappés and barista accessories.',
      'Découvrez la gamme professionnelle MONIN distribuée en Tunisie : sirops, sauces, purées de fruits, frappés et accessoires barista.',
    ],
  },
  hygiene: {
    name: ['Hygiene', 'Hygiène'],
    short: ['Hygiene', 'Hygiène'],
    description: [
      'Cellulose paper, gloves, kitchen and catering wear, and detergents for food handling, healthcare and pharmaceutical environments.',
      "Papier cellulose, gants, consommables pour cuisine et restauration, et détergents pour la manipulation alimentaire, la santé et l'industrie pharmaceutique.",
    ],
    long: [
      'Single-use protection for environments where contamination control matters: napkins, toilet paper and paper towels, latex, vinyl, nitrile and polyethylene gloves, masks, hair nets, chef hats, overshoes, aprons, coats and sleeve covers, and detergents.',
      'La protection à usage unique pour les environnements où la maîtrise de la contamination est essentielle : serviettes, papier hygiénique et essuie-tout, gants latex, vinyle, nitrile et polyéthylène, masques, coiffes, toques et calots, surchaussures, tabliers, blouses et manchettes, et détergents.',
    ],
    image: '/img/categories/hygiene.jpg',
    icon: 'shield',
    seoTitle: [
      'Hygiene Products — Gloves, Masks, Aprons Tunisia',
      'Produits d’hygiène — Gants, masques, tabliers Tunisie',
    ],
    seoDescription: [
      'Cellulose paper, disposable gloves, masks, hair nets, aprons and detergents for food handling, healthcare and pharmaceutical environments in Tunisia.',
      "Papier cellulose, gants jetables, masques, coiffes, tabliers et détergents pour la manipulation alimentaire, la santé et l'industrie pharmaceutique en Tunisie.",
    ],
  },
};

const text = ([en, fr]) => `{ en: ${q(en)}, fr: ${q(fr)} }`;

let out = `// =============================================================================
// CATEGORIES — the catalogue tree: division > category > sub-category.
//
// GENERATED by scripts/generate-categories.mjs from
// backend/src/main/resources/catalog/taxonomy.json, the single source of truth
// that the API also applies to the database at startup. Edit the JSON (or the
// division texts in the script), then regenerate; do not edit by hand.
//
// The tree follows vinto.tn: the same families in the same order, without its
// duplicates and typos.
// =============================================================================

import { Category, Subcategory } from '../shared/models/catalog.model';

export const CATEGORIES: readonly Category[] = [
`;
for (const division of tax.divisions) {
  const m = META[division.id];
  if (!m) throw new Error(`No division texts for "${division.id}" in generate-categories.mjs`);
  out +=
    `  {\n    id: ${q(division.id)},\n    slug: ${q(division.id)},\n` +
    `    name: ${text(m.name)},\n    shortName: ${text(m.short)},\n` +
    `    description: ${text(m.description)},\n    longDescription: ${text(m.long)},\n` +
    `    image: ${q(m.image)},\n    icon: ${q(m.icon)},\n    accent: ${q(`var(--c-cat-${division.id})`)},\n` +
    `    subcategories: [\n${(division.children ?? []).map((c) => sub(c, division.id, 6)).join('')}    ],\n` +
    `    seo: { title: ${text(m.seoTitle)}, description: ${text(m.seoDescription)} },\n  },\n`;
}
out += `];

/** Every category and sub-category below the divisions, depth first. */
export const ALL_SUBCATEGORIES: readonly Subcategory[] = (() => {
  const out: Subcategory[] = [];
  const walk = (items: readonly Subcategory[]): void => {
    for (const item of items) {
      out.push(item);
      if (item.children) walk(item.children);
    }
  };
  for (const category of CATEGORIES) walk(category.subcategories);
  return out;
})();

/** The second-level category a sub-category belongs to, or the category itself. */
export function parentSubcategory(id: string): Subcategory | null {
  for (const category of CATEGORIES) {
    for (const sub of category.subcategories) {
      if (sub.id === id || sub.children?.some((child) => child.id === id)) return sub;
    }
  }
  return null;
}
`;
writeFileSync(target, out);
console.log(`categories.data.ts: ${tax.divisions.length} divisions written`);
