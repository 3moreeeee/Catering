// Reconciliation of the website catalogue against the company's own supplier
// price lists (the PDFs under imformations_about_products_provided_by_the_client).
//
// The Vinto feeds in products.imported.data.ts and products.monin.data.ts are
// generated files, so the reconciliation is layered on top of them here rather
// than edited into them: a later Vinto re-sync cannot silently undo it, and
// every change keeps the PDF line that justifies it.
//
// The same records drive three consumers:
//   - PRODUCTS in products.data.ts (the bundled catalogue),
//   - scripts/export-backend-seed.mjs (a fresh database),
//   - scripts/export-catalog-reconciliation.mjs, which writes the batch the
//     backend's CatalogReconciliationRunner applies to an existing database,
//     plus the human and machine-readable reports.
//
// Prices and sale lots come from the same PDFs (decision of 2026-09-29: the
// whole catalogue is priced from the supplier lists, HT); see
// supplier-price-lists.data.ts for the lines and the pricing rule.

import { CategoryId, IndustryId, Product, ProductFormat } from '../shared/models/catalog.model';
import { LocalizedText } from '../shared/models/localized-text.model';
import { SUPPLIER_PDF } from './supplier-pdfs';
import { CATALOG_IMAGES } from './catalog-images.data';
import { SupplierPricing, supplierPricing, websiteLotOf } from './supplier-price-lists.data';

/** Identifies this batch in the backend log and in the reports. */
export const CATALOG_RECONCILIATION_BATCH = '2026-09-supplier-pdf';

export { SUPPLIER_PDF };

type SupplierPdf = (typeof SUPPLIER_PDF)[keyof typeof SUPPLIER_PDF];

/** Why a change was made: the supplier line it rests on. */
interface Evidence {
  readonly sourcePdf: SupplierPdf | 'Aucune liste fournisseur';
  /** The PDF designation, or the lines consulted to establish an absence. */
  readonly sourceDesignation: string;
  readonly reason: string;
}

/** A catalogue record withdrawn from sale. The backend deactivates it; nothing is deleted. */
export interface CatalogRemoval extends Evidence {
  readonly id: string;
  readonly action: 'DELETE' | 'MERGE';
  /** For a merge, the record that now represents the supplier line. */
  readonly mergedInto?: string;
}

/** A valid record whose identity or format disagreed with the supplier list. */
export interface CatalogCorrection extends Evidence {
  readonly id: string;
  readonly action: 'CORRECT' | 'MERGE';
  readonly name: LocalizedText;
  /** Replaces the first format's display value, keeping its pack quantity. */
  readonly format?: string;
  /** The supplier's own reference, when the list publishes one. */
  readonly reference?: string;
}

/** A supplier line missing from the website. */
export interface CatalogAddition extends Evidence {
  readonly id: string;
  readonly slug: string;
  readonly categoryId: CategoryId;
  readonly subcategoryId: string;
  readonly brandId?: string;
  readonly name: LocalizedText;
  readonly format?: string;
  readonly packQuantity?: number;
  readonly reference?: string;
  /** Extra supplier facts (film gauge, colours, availability) appended to the description. */
  readonly details?: LocalizedText;
  /** Set only from the supplier list: 0 for a line marked "Rupture provisoire". */
  readonly stockQuantity?: number;
}

// ---------------------------------------------------------------------------
// Removals

const RUPTURE = {
  fr: 'Rupture provisoire chez le fournisseur ; disponibilité confirmée sur demande.',
  en: 'Temporarily out of stock at the supplier; availability confirmed on request.',
};

export const CATALOG_REMOVALS: readonly CatalogRemoval[] = [
  {
    id: 'p-vinto-488',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.food,
    sourceDesignation: 'MAÏS DOUX EMPORIUM 1/4 184 GR · 1/2 425 GR · 3/1 3100 ML',
    reason: 'Format 800 g absent de la liste officielle',
  },
  {
    id: 'p-monin-295',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Seul « Thé Pêche 1L » figure dans la liste ; aucun sirop pêche 70cl',
    reason: 'Produit absent de la liste MONIN',
  },
  {
    id: 'p-monin-311',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Aucune ligne « concombre » (sirops 70cl, 1L, 25cl)',
    reason: 'Produit absent de la liste MONIN',
  },
  {
    id: 'p-monin-337',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Aucune ligne « fleur de sureau » (sirops 70cl, 1L, 25cl)',
    reason: 'Produit absent de la liste MONIN',
  },
  {
    id: 'p-vinto-99',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.film,
    sourceDesignation: 'Rouleau Papier Aluminium 30cm × 100 m · 45cm × 100 m · 45cm × 150 m',
    reason: 'Format 30 cm × 200 m absent de la liste officielle',
  },
  {
    id: 'p-vinto-246',
    action: 'DELETE',
    sourcePdf: 'Aucune liste fournisseur',
    sourceDesignation: 'Absent des 13 listes fournies',
    reason: 'Import Vinto hors catalogue Catering',
  },
  {
    id: 'p-vinto-254',
    action: 'DELETE',
    sourcePdf: 'Aucune liste fournisseur',
    sourceDesignation: 'Absent des 13 listes fournies',
    reason: 'Import Vinto hors catalogue Catering',
  },
  {
    id: 'p-vinto-255',
    action: 'DELETE',
    sourcePdf: 'Aucune liste fournisseur',
    sourceDesignation: 'Absent des 13 listes fournies',
    reason: 'Import Vinto hors catalogue Catering',
  },
  ...['75', '76', '77', '79', '80', '82'].map((suffix): CatalogRemoval => ({
    id: `p-vinto-263-${suffix}`,
    action: 'DELETE',
    sourcePdf: 'Aucune liste fournisseur',
    sourceDesignation: 'Absent des 13 listes fournies',
    reason: 'Import Vinto hors catalogue Catering (planche à découper, 6 couleurs)',
  })),
  {
    id: 'p-vinto-395',
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.verrines,
    sourceDesignation: 'VERRINE TUBE 70 ML TRANSPARENTE (seule verrine tube listée)',
    reason: 'Version blanche absente de la liste officielle',
  },
  ...[
    ['p-vinto-406', 'Pomme 1L'],
    ['p-vinto-409', 'Agrume 1L'],
    ['p-vinto-411', 'Citron vert 1L'],
    ['p-vinto-413', 'Citron jaune Lamaa 5L'],
  ].map(([id]): CatalogRemoval => ({
    id: id!,
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Aucun liquide vaisselle dans la liste hygiène',
    reason: 'Produit absent de la liste hygiène',
  })),
  ...['p-vinto-436-1', 'p-vinto-439-6', 'p-vinto-440-2'].map((id): CatalogRemoval => ({
    id,
    action: 'DELETE',
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Aucun essuie-tout dans la liste hygiène',
    reason: 'Produit absent de la liste hygiène',
  })),
  {
    id: 'p-vinto-149',
    action: 'MERGE',
    mergedInto: 'p-vinto-148',
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Coiffe ou charlotte · Coiffe "Bouffant"',
    reason:
      'Seconde interprétation importée de « Coiffe ou charlotte » (même photographie que p-vinto-148)',
  },
];

// ---------------------------------------------------------------------------
// Corrections

const glass = (
  id: string,
  ml: 250 | 300 | 400,
  reference: string,
  fr: string,
  en: string,
): CatalogCorrection => ({
  id,
  action: 'CORRECT',
  reference,
  name: {
    fr: `Verre en polycarbonate ${ml}ml - ${fr}- LES 5 PIÈCES`,
    en: `Polycarbonate glass ${ml} ml, ${en}, pack of 5 pieces`,
  },
  sourcePdf: SUPPLIER_PDF.polycarbonate,
  sourceDesignation: `${reference} Verre en polycarbonate ${ml}ml${fr === 'transparent' ? '' : ` - ${fr}`}`,
  reason: 'Couleur perdue dans le nom importé (référence fournisseur Vinto conservée)',
});

export const CATALOG_CORRECTIONS: readonly CatalogCorrection[] = [
  {
    id: 'p-vinto-120',
    action: 'CORRECT',
    format: '26 cm · 36.5 cm',
    name: {
      fr: 'Papier dentelle rectangulaire 26cm x 36,5cm- LES 250 PIÈCES',
      en: 'Rectangular doily 26 × 36.5 cm, pack of 250 pieces',
    },
    sourcePdf: SUPPLIER_PDF.pastry,
    sourceDesignation: 'PAPIER DENTELLE 26 x 36,5CM',
    reason: 'Dimensions erronées (25 × 35 cm)',
  },
  {
    id: 'p-vinto-122',
    action: 'CORRECT',
    format: '36 cm · 44 cm',
    name: {
      fr: 'Papier dentelle rectangulaire 36cm x 44cm- LES 250 PIÈCES',
      en: 'Rectangular doily 36 × 44 cm, pack of 250 pieces',
    },
    sourcePdf: SUPPLIER_PDF.pastry,
    sourceDesignation: 'PAPIER DENTELLE 36 x 44CM',
    reason: 'Dimensions erronées (36 × 45 cm)',
  },
  {
    id: 'p-vinto-373',
    action: 'CORRECT',
    format: '1100 ml',
    name: {
      fr: 'Bol à soupe avec couvercle en carton blanc 1100ml - LES 25 BOITES',
      en: 'White card soup bowl with lid 1100 ml, pack of 25 boxes',
    },
    sourcePdf: SUPPLIER_PDF.packaging,
    sourceDesignation: 'Bol à soupe en carton blanc 1100ml avec couvercle',
    reason: 'Contenance erronée (1000 ml appartient à la gamme kraft)',
  },
  {
    id: 'p-vinto-186',
    action: 'CORRECT',
    format: '60 ml',
    name: {
      fr: 'Verrine rond-carrée 60ml- LES 60 PIÈCES',
      en: 'Round-square verrine 60 ml, pack of 60 pieces',
    },
    sourcePdf: SUPPLIER_PDF.verrines,
    sourceDesignation: 'VERRINE ROND-CARRÉE 60 ML',
    reason: 'Contenance erronée (50 ml)',
  },
  {
    id: 'p-vinto-210',
    action: 'CORRECT',
    format: '13 cm',
    name: { fr: 'Pique P 13cm- LES 50 PIÈCES', en: 'P pick 13 cm, pack of 50 pieces' },
    sourcePdf: SUPPLIER_PDF.picks,
    sourceDesignation: 'Pics P 13cm',
    reason: 'Longueur erronée (12 cm)',
  },
  {
    id: 'p-monin-453',
    action: 'CORRECT',
    format: '25 ml – 50 ml',
    name: {
      fr: 'Doseur inox double face MONIN 25ml - 50ml',
      en: 'MONIN double-sided stainless steel jigger 25 ml - 50 ml',
    },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Doseur inox double face 25ml-50ml',
    reason: 'Nom générique « Doseur métal MONIN » en double (réf. Vinto MONIN 25/50)',
  },
  {
    id: 'p-monin-288',
    action: 'CORRECT',
    format: '30 ml – 60 ml',
    name: {
      fr: 'Grand doseur inox double face MONIN 30ml - 60ml',
      en: 'MONIN large double-sided stainless steel jigger 30 ml - 60 ml',
    },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Grand doseur inox double face 30ml - 60ml',
    reason: 'Nom générique « Doseur métal MONIN » en double (réf. Vinto MONIN 30/60)',
  },
  {
    id: 'p-monin-286',
    action: 'CORRECT',
    name: { fr: 'Pompe 10ml MONIN pour sirop 1L', en: 'MONIN 10 ml pump for 1 l syrup' },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Pompe 10ml pour sirop 1L',
    reason: 'Deux pompes 10 ml indiscernables (réf. Vinto MONIN 1L)',
  },
  {
    id: 'p-monin-285',
    action: 'CORRECT',
    name: { fr: 'Pompe 10ml MONIN pour sirop 70cl', en: 'MONIN 10 ml pump for 70 cl syrup' },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Pompe 10ml pour sirop 70cl',
    reason: 'Deux pompes 10 ml indiscernables (réf. Vinto MONIN 70 CL)',
  },
  {
    id: 'p-monin-287',
    action: 'CORRECT',
    name: { fr: 'Pompe 15ml MONIN pour sauce', en: 'MONIN 15 ml pump for sauce' },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Pompe 15ml pour sauce',
    reason: 'Usage non précisé dans le nom',
  },
  {
    id: 'p-monin-293',
    action: 'CORRECT',
    format: '20 × 60 cm',
    name: { fr: 'Tapis de bar en caoutchouc MONIN 20/60cm', en: 'MONIN rubber bar mat 20/60 cm' },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Tapis de Bar en caoutchouc Monin 20/60cm',
    reason: 'Désignation « Barmat » sans matière ni dimensions',
  },
  {
    id: 'p-monin-363',
    action: 'CORRECT',
    format: '28 cm',
    name: {
      fr: 'Cuillère à cocktail en inox MONIN, L 28cm',
      en: 'MONIN stainless steel cocktail spoon, L 28 cm',
    },
    sourcePdf: SUPPLIER_PDF.monin,
    sourceDesignation: 'Cuillère à cocktail en inox, L 28cm',
    reason: 'Désignation « Cuillère à mélange » non conforme',
  },
  // Formats the Vinto import reduced to a single figure; the supplier lists
  // print the full dimensions and the film gauge.
  ...(
    [
      [
        'p-vinto-483',
        'Barquette à sushi 170x122x30mm-Les 100 Pièces',
        'Tray sushi pack of 100 pieces 170x122x30mm',
        '170 × 122 × 30 mm',
        'Barquette à sushi 170x122x30mm',
      ],
      [
        'p-vinto-484',
        'Barquette à sushi 193x137x30mm-Les 100 Pièces',
        'Tray sushi pack of 100 pieces 193x137x30mm',
        '193 × 137 × 30 mm',
        'Barquette à sushi 193x137x30mm',
      ],
      [
        'p-vinto-485',
        'Barquette à sushi 224x142x30mm-Les 100 Pièces',
        'Tray sushi pack of 100 pieces 224x142x30mm',
        '224 × 142 × 30 mm',
        'Barquette à sushi 224x142x30mm',
      ],
    ] as const
  ).map(([id, fr, en, format, sourceDesignation]): CatalogCorrection => ({
    id,
    action: 'CORRECT',
    format,
    name: { fr, en },
    sourcePdf: SUPPLIER_PDF.packaging,
    sourceDesignation,
    reason: 'Format importé réduit à « 30 mm » ; dimensions complètes publiées',
  })),
  ...(
    [
      ['p-vinto-93', 'Film étirable alimentaire sans boite distributrice, l 30cm - L 50m', 50],
      ['p-vinto-94', 'Film étirable alimentaire sans boite distributrice, l 30cm - L 100m', 100],
    ] as const
  ).map(([id, fr, length]): CatalogCorrection => ({
    id,
    action: 'CORRECT',
    format: `30 cm · ${length} m · 9 µm`,
    name: { fr, en: `Food cling film without dispenser box, w 30 cm - L ${length} m` },
    sourcePdf: SUPPLIER_PDF.film,
    sourceDesignation: `Film étirable sans Boite Distributrice, largeur 30cm, longueur ${length} mètres, 9 microns`,
    reason: 'Épaisseur (9 microns) publiée par la liste, absente du format',
  })),
  // Vinto's own supplier references identify each colour: P/PCG-11-R is the
  // red-based 250 ml glass, and so on. The PDF publishes the same codes.
  glass('p-vinto-56', 250, 'P/PCG-11-R', 'fond rouge', 'red base'),
  glass('p-vinto-57', 250, 'P/PCG-11-V', 'fond vert', 'green base'),
  glass('p-vinto-58', 250, 'P/PCG-11-M', 'fond violet', 'purple base'),
  glass('p-vinto-59', 250, 'P/PCG-11-B', 'fond bleu', 'blue base'),
  glass('p-vinto-467', 250, 'P/PCG-11-J', 'fond jaune', 'yellow base'),
  glass('p-vinto-60', 300, 'P/PCG12-R', 'fond rouge', 'red base'),
  glass('p-vinto-62', 300, 'P/PCG12-J', 'fond jaune', 'yellow base'),
  glass('p-vinto-64', 300, 'P/PCG12-T', 'transparent', 'clear'),
  glass('p-vinto-65', 300, 'P/PCG12-V', 'fond vert', 'green base'),
  glass('p-vinto-468', 300, 'P/PCG12-M', 'fond violet', 'purple base'),
  glass('p-vinto-70', 400, 'P/PCG13-J', 'fond jaune', 'yellow base'),
  {
    id: 'p-vinto-148',
    action: 'CORRECT',
    name: {
      fr: 'Coiffe ou charlotte en non tissé- LES 100 PIÈCES',
      en: 'Non-woven hairnet (charlotte), pack of 100 pieces',
    },
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Coiffe ou charlotte',
    reason: 'Désignation importée « coiffe simple élastique » ; absorbe p-vinto-149',
  },
  // One supplier line in two colours. Both SKUs stay orderable and are shown as
  // one product with a colour choice (see product-color-variants.ts).
  {
    id: 'p-vinto-151',
    action: 'MERGE',
    name: {
      fr: 'Calot rayé rouge en papier- LES 100 PIÈCES',
      en: 'Paper cap with red stripe, pack of 100 pieces',
    },
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Calot Rayé Rouge-Bleu',
    reason:
      'Doublon visible « Calot rayé en papier » : variante rayure rouge (réf. Vinto PAL ROUGE)',
  },
  {
    id: 'p-vinto-349',
    action: 'MERGE',
    name: {
      fr: 'Calot rayé bleu en papier- LES 100 PIÈCES',
      en: 'Paper cap with blue stripe, pack of 100 pieces',
    },
    sourcePdf: SUPPLIER_PDF.hygiene,
    sourceDesignation: 'Calot Rayé Rouge-Bleu',
    reason:
      'Doublon visible « Calot rayé en papier » : variante rayure bleue (réf. Vinto PAL CLBEP)',
  },
  {
    id: 'p-vinto-348',
    action: 'MERGE',
    name: {
      fr: 'Verrine goutte 11ml transparente- LES 50 PIÈCES',
      en: 'Drop verrine 11 ml clear, pack of 50 pieces',
    },
    sourcePdf: SUPPLIER_PDF.verrines,
    sourceDesignation: 'VERRINE GOUTTE 11 ML TRANSPARENTE / NOIRE',
    reason:
      'Doublon visible « Verrine goutte 11ml » : variante transparente (réf. Vinto VERRINE transparent)',
  },
  {
    id: 'p-vinto-183',
    action: 'MERGE',
    name: {
      fr: 'Verrine goutte 11ml noire- LES 50 PIÈCES',
      en: 'Drop verrine 11 ml black, pack of 50 pieces',
    },
    sourcePdf: SUPPLIER_PDF.verrines,
    sourceDesignation: 'VERRINE GOUTTE 11 ML TRANSPARENTE / NOIRE',
    reason: 'Doublon visible « Verrine goutte 11ml » : variante noire (réf. Vinto VERRINE noire)',
  },
];

// ---------------------------------------------------------------------------
// Additions

const monin = (
  id: string,
  slug: string,
  subcategoryId: string,
  fr: string,
  en: string,
  format: string,
  sourceDesignation: string,
): CatalogAddition => ({
  id,
  slug: `monin-${slug}`,
  categoryId: 'monin',
  subcategoryId,
  brandId: 'monin',
  name: { fr, en },
  format,
  sourcePdf: SUPPLIER_PDF.monin,
  sourceDesignation,
  reason: 'Référence officielle absente du site',
});

const syrup = (
  id: string,
  slug: string,
  fr: string,
  en: string,
  format: string,
  designation: string,
) => monin(id, slug, 'syrups', fr, en, format, designation);
const puree = (id: string, slug: string, fruitFr: string, fruitEn: string, designation: string) =>
  monin(
    id,
    slug,
    'fruit-purees',
    `Purée de ${fruitFr} MONIN 1L`,
    `MONIN ${fruitEn} fruit purée 1 l`,
    '1 l',
    designation,
  );

export const CATALOG_ADDITIONS: readonly CatalogAddition[] = [
  // Agro-alimentaire
  ...(
    [
      [
        'p-fk-champignons-emporium-425g',
        'champignons-en-tranches-emporium-425g',
        'canned',
        'emporium',
        'Champignons en tranches Emporium 425g',
        'Sliced mushrooms Emporium 425 g',
        '425 g',
        'CHAMPIGNONS EN TRANCHE EMPORIUM 1/2 · 425 GR',
      ],
      [
        'p-fk-champignons-emporium-850g',
        'champignons-en-tranches-emporium-850g',
        'canned',
        'emporium',
        'Champignons en tranches Emporium 850g',
        'Sliced mushrooms Emporium 850 g',
        '850 g',
        'CHAMPIGNONS EN TRANCHE EMPORIUM 1 KG · 850 GR',
      ],
      [
        'p-fk-mais-doux-emporium-425g',
        'mais-doux-emporium-425g',
        'canned',
        'emporium',
        'Maïs doux Emporium 425g',
        'Sweetcorn Emporium 425 g',
        '425 g',
        'MAÏS DOUX EMPORIUM 1/2 · 425 GR',
      ],
      [
        'p-fk-mais-doux-emporium-3100ml',
        'mais-doux-emporium-3100ml',
        'canned',
        'emporium',
        'Maïs doux Emporium 3100ml',
        'Sweetcorn Emporium 3100 ml',
        '3100 ml',
        'MAÏS DOUX EMPORIUM 3/1 · 3100 ML',
      ],
      [
        'p-fk-haricots-rouges-emporium-400g',
        'haricots-rouges-emporium-400g',
        'canned',
        'emporium',
        'Haricots rouges Emporium 400g',
        'Red kidney beans Emporium 400 g',
        '400 g',
        'HARICOTS ROUGES EMPORIUM 1/2 · 400GR',
      ],
      [
        'p-fk-moutarde-dijon-dijona-850g',
        'moutarde-forte-de-dijon-dijona-850g',
        'condiments',
        'dijona',
        'Moutarde forte de Dijon Dijona 850gr',
        'Dijon mustard Dijona 850 g',
        '850 g',
        'MOUTARDE FORTE DE DIJON · 850 GR · DIJONA',
      ],
    ] as const
  ).map(
    ([id, slug, subcategoryId, brandId, fr, en, format, sourceDesignation]): CatalogAddition => ({
      id,
      slug: `catalogue-${slug}`,
      categoryId: 'food',
      subcategoryId,
      brandId,
      name: { fr, en },
      format,
      sourcePdf: SUPPLIER_PDF.food,
      sourceDesignation,
      reason: 'Format officiel absent du site',
    }),
  ),

  // MONIN — sirops 70 cl
  syrup(
    'p-fk-monin-citron-vert-70cl',
    'sirop-citron-vert-70cl',
    'Sirop citron vert MONIN 70cl',
    'MONIN lime syrup 70 cl',
    '70 cl',
    'Sirop de Citron vert 70cl',
  ),
  syrup(
    'p-fk-monin-pasteque-70cl',
    'sirop-pasteque-70cl',
    'Sirop pastèque MONIN 70cl',
    'MONIN watermelon syrup 70 cl',
    '70 cl',
    'Sirop Pasteque 70cl',
  ),
  syrup(
    'p-fk-monin-melon-70cl',
    'sirop-melon-70cl',
    'Sirop melon MONIN 70cl',
    'MONIN melon syrup 70 cl',
    '70 cl',
    'Sirop Melon 70cl',
  ),
  syrup(
    'p-fk-monin-orange-70cl',
    'sirop-orange-70cl',
    'Sirop orange MONIN 70cl',
    'MONIN orange syrup 70 cl',
    '70 cl',
    'Sirop Orange 70cl',
  ),
  syrup(
    'p-fk-monin-brownies-70cl',
    'sirop-brownies-70cl',
    'Sirop brownies MONIN 70cl',
    'MONIN brownie syrup 70 cl',
    '70 cl',
    'Sirop Brownies 70cl',
  ),
  syrup(
    'p-fk-monin-barbe-a-papa-70cl',
    'sirop-barbe-a-papa-70cl',
    'Sirop barbe à papa MONIN 70cl',
    'MONIN cotton candy syrup 70 cl',
    '70 cl',
    'Sirop Barbe à Papa 70cl',
  ),
  syrup(
    'p-fk-monin-cookies-70cl',
    'sirop-cookies-70cl',
    'Sirop cookies MONIN 70cl',
    'MONIN cookie syrup 70 cl',
    '70 cl',
    'Sirop cookies 70cl',
  ),
  // Vinto lists this reference (listing 307), so it keeps Vinto's stock and page.
  syrup(
    'p-monin-307',
    'sirop-caramel-sale-70cl-307',
    'Sirop caramel salé MONIN 70cl',
    'MONIN salted caramel syrup 70 cl',
    '70 cl',
    'Sirop caramel salée 70cl',
  ),
  syrup(
    'p-fk-monin-toffee-nut-70cl',
    'sirop-toffee-nut-70cl',
    'Sirop toffee nut MONIN 70cl',
    'MONIN toffee nut syrup 70 cl',
    '70 cl',
    'Sirop Toffee nut 70cl',
  ),
  syrup(
    'p-fk-monin-mure-70cl',
    'sirop-mure-70cl',
    'Sirop mûre MONIN 70cl',
    'MONIN blackberry syrup 70 cl',
    '70 cl',
    'Sirop de mûre 70cl',
  ),
  // MONIN — 1 L
  syrup(
    'p-fk-monin-the-citron-1l',
    'sirop-the-citron-1l',
    'Sirop thé citron MONIN 1L',
    'MONIN lemon tea syrup 1 l',
    '1 l',
    'Thé citron 1L',
  ),
  syrup(
    'p-fk-monin-the-peche-1l',
    'sirop-the-peche-1l',
    'Sirop thé pêche MONIN 1L',
    'MONIN peach tea syrup 1 l',
    '1 l',
    'Thé Pêche 1L',
  ),
  syrup(
    'p-fk-monin-framboise-1l',
    'sirop-framboise-1l',
    'Sirop framboise MONIN 1L',
    'MONIN raspberry syrup 1 l',
    '1 l',
    'Sirop Framboise 1L',
  ),
  syrup(
    'p-fk-monin-fruit-de-la-passion-1l',
    'sirop-fruit-de-la-passion-1l',
    'Sirop fruit de la passion MONIN 1L',
    'MONIN passion fruit syrup 1 l',
    '1 l',
    'Sirop Fruit De la Passion 1L',
  ),
  syrup(
    'p-fk-monin-caramel-1l',
    'sirop-caramel-1l',
    'Sirop caramel MONIN 1L',
    'MONIN caramel syrup 1 l',
    '1 l',
    'Sirop de Caramel 1L',
  ),
  // MONIN — 25 cl
  syrup(
    'p-fk-monin-vanille-25cl',
    'sirop-vanille-25cl',
    'Sirop vanille MONIN 25cl',
    'MONIN vanilla syrup 25 cl',
    '25 cl',
    'Sirop de Vanille 25cl',
  ),
  syrup(
    'p-fk-monin-fruit-de-la-passion-25cl',
    'sirop-fruit-de-la-passion-25cl',
    'Sirop fruit de la passion MONIN 25cl',
    'MONIN passion fruit syrup 25 cl',
    '25 cl',
    'Sirop de Fruit de la Passion 25cl',
  ),
  syrup(
    'p-fk-monin-noix-de-coco-25cl',
    'sirop-noix-de-coco-25cl',
    'Sirop saveur noix de coco MONIN 25cl',
    'MONIN coconut syrup 25 cl',
    '25 cl',
    'Sirop Saveur Noix de Coco 25cl',
  ),
  syrup(
    'p-fk-monin-chocolat-cookie-25cl',
    'sirop-chocolat-cookie-25cl',
    'Sirop saveur chocolat cookie MONIN 25cl',
    'MONIN chocolate cookie syrup 25 cl',
    '25 cl',
    'Sirop Saveur Chocolat Cookie 25cl',
  ),
  syrup(
    'p-fk-monin-caramel-25cl',
    'sirop-caramel-25cl',
    'Sirop saveur caramel MONIN 25cl',
    'MONIN caramel syrup 25 cl',
    '25 cl',
    'Sirop Saveur Caramel 25cl',
  ),
  // MONIN — purées. Listings 268, 275 and 276 exist on Vinto and keep its ids.
  puree(
    'p-monin-275',
    'puree-noix-de-coco-1l-275',
    'noix de coco',
    'coconut',
    'Purée de Noix de Coco 1L',
  ),
  puree('p-monin-268', 'puree-fraise-1l-268', 'fraise', 'strawberry', 'Purée de Fraise 1L'),
  puree('p-fk-monin-puree-peche-1l', 'puree-peche-1l', 'pêche', 'peach', 'Purée de Peche 1L'),
  puree(
    'p-fk-monin-puree-framboise-1l',
    'puree-framboise-1l',
    'framboise',
    'raspberry',
    'Purée de Framboise 1L',
  ),
  puree('p-monin-276', 'puree-myrtilles-1l-276', 'myrtilles', 'blueberry', 'Purée de Myrtilles 1L'),
  puree('p-fk-monin-puree-mangue-1l', 'puree-mangue-1l', 'mangue', 'mango', 'Purée de Mangue 1L'),
  puree(
    'p-fk-monin-puree-passion-1l',
    'puree-passion-1l',
    'passion',
    'passion fruit',
    'Purée de Passion 1L',
  ),
  puree('p-fk-monin-puree-banane-1l', 'puree-banane-1l', 'banane', 'banana', 'Purée de Banane 1L'),
  puree('p-fk-monin-puree-lychee-1l', 'puree-lychee-1l', 'lychee', 'lychee', 'Purée de Lychee 1L'),
  puree('p-fk-monin-puree-ananas-1l', 'puree-ananas-1l', 'ananas', 'pineapple', 'Purée Ananas 1L'),
  // MONIN — sauce, frappé, accessory
  monin(
    'p-fk-monin-sauce-chocolat-blanc-1-89l',
    'sauce-chocolat-blanc-1-89l',
    'sauces',
    'Sauce chocolat blanc MONIN 1,89L',
    'MONIN white chocolate sauce 1.89 l',
    '1.89 l',
    'Sauce Chocolat Blanc 1,89 L',
  ),
  monin(
    'p-fk-monin-frappe-cafe-sac-2kg',
    'frappe-cafe-sac-2kg',
    'frappe-bases',
    'Frappé café MONIN sac 2kg',
    'MONIN coffee frappé base, 2 kg bag',
    '2 kg',
    'Frappé café sac de 2kg',
  ),
  monin(
    'p-fk-monin-frappe-neutre-1-36kg',
    'frappe-neutre-1-36kg',
    'frappe-bases',
    'Frappé neutre MONIN 1.36kg',
    'MONIN neutral frappé base 1.36 kg',
    '1.36 kg',
    'Frappé neutre 1,36kg',
  ),
  monin(
    'p-fk-monin-frappe-neutre-sac-2kg',
    'frappe-neutre-sac-2kg',
    'frappe-bases',
    'Frappé neutre MONIN sac 2kg',
    'MONIN neutral frappé base, 2 kg bag',
    '2 kg',
    'Frappé neutre sac de 2kg',
  ),
  monin(
    'p-fk-monin-frappe-vanille-sac-2kg',
    'frappe-vanille-sac-2kg',
    'frappe-bases',
    'Frappé vanille MONIN sac 2kg',
    'MONIN vanilla frappé base, 2 kg bag',
    '2 kg',
    'Frappé vanille sac de 2kg',
  ),
  monin(
    'p-fk-monin-frappe-chocolat-1-36kg',
    'frappe-chocolat-1-36kg',
    'frappe-bases',
    'Frappé chocolat MONIN 1.36kg',
    'MONIN chocolate frappé base 1.36 kg',
    '1.36 kg',
    'Frappé Chocolat 1,36kg',
  ),
  monin(
    'p-fk-monin-bac-glacons-6l',
    'bac-de-stockage-a-glacons-6l',
    'bar-tools',
    'Bac de stockage à glaçons MONIN 6L',
    'MONIN ice storage bin 6 l',
    '6 l',
    'Bac de stockage à glaçons 6 L',
  ),

  // Pâtisserie
  {
    id: 'p-fk-papier-cuisson-multi-passages-40x60',
    slug: 'catalogue-papier-cuisson-multi-passages-40x60',
    categoryId: 'packaging',
    subcategoryId: 'films-papers',
    name: {
      fr: 'Papier cuisson multi-passages 40cm x 60cm - La rame de 500 feuilles',
      en: 'Multi-use baking paper 40 × 60 cm, ream of 500 sheets',
    },
    format: '40 cm · 60 cm',
    packQuantity: 500,
    sourcePdf: SUPPLIER_PDF.pastry,
    sourceDesignation: 'PAPIER CUISSON multi-passages 40 cm x 60 cm · 500 FEUILLES/RAME',
    reason: 'Référence officielle absente du site',
  },
  {
    id: 'p-fk-ruban-patissier-40mm',
    slug: 'catalogue-ruban-patissier-pvc-40mm',
    categoryId: 'packaging',
    subcategoryId: 'films-papers',
    name: { fr: 'Ruban pâtissier en PVC - hauteur 40mm', en: 'PVC pastry ribbon, height 40 mm' },
    format: '40 mm',
    sourcePdf: SUPPLIER_PDF.pastry,
    sourceDesignation: 'RUBAN REDUITE 40 MM',
    reason: 'Format officiel absent du site (30 et 50 mm présents)',
  },

  // Films et aluminium
  ...(
    [
      [
        'p-fk-film-avec-boite-30cm-300m',
        'avec',
        30,
        300,
        { fr: '9 microns, 1150 g.', en: '9 microns, 1150 g.' },
        'Film étirable avec Boite Distributrice, largeur 30cm, longueur 300 mètres, 9 microns, 1150gr',
      ],
      [
        'p-fk-film-avec-boite-45cm-300m',
        'avec',
        45,
        300,
        { fr: '9 microns, 1720 g.', en: '9 microns, 1720 g.' },
        'Film étirable avec Boite Distributrice, largeur 45cm, longueur 300 mètres, 9 microns, 1720gr',
      ],
      [
        'p-fk-film-avec-boite-30cm-1500m',
        'avec',
        30,
        1500,
        { fr: '14 microns.', en: '14 microns.' },
        'Film étirable avec Boite Distributrice 300 mm x 1500 mètres 14 micron',
      ],
      [
        'p-fk-film-avec-boite-45cm-1500m',
        'avec',
        45,
        1500,
        { fr: '12 microns.', en: '12 microns.' },
        'Film étirable avec Boite Distributrice 450 mm x1500 mètres 12 micron',
      ],
      [
        'p-fk-film-sans-boite-30cm-300m',
        'sans',
        30,
        300,
        { fr: '9 microns, 1150 g.', en: '9 microns, 1150 g.' },
        'Film étirable sans Boite Distributrice, largeur 30cm, longueur 300 mètres, 9 microns, 1150gr',
      ],
      [
        'p-fk-film-sans-boite-45cm-300m',
        'sans',
        45,
        300,
        { fr: '9 microns, 1720 g.', en: '9 microns, 1720 g.' },
        'Film étirable sans Boite Distributrice, largeur 45cm, longueur 300 mètres, 9 microns, 1720gr',
      ],
    ] as const
  ).map(([id, box, width, length, details, sourceDesignation]): CatalogAddition => ({
    id,
    slug: `catalogue-film-etirable-${box}-boite-${width}cm-${length}m`,
    categoryId: 'packaging',
    subcategoryId: 'trays-containers',
    name: {
      fr: `Film étirable alimentaire ${box} boite distributrice, l ${width}cm - L ${length}m`,
      en: `Food cling film ${box === 'avec' ? 'with' : 'without'} dispenser box, w ${width} cm - L ${length} m`,
    },
    // The gauge is the first figure of the supplier details ("9 microns, 1150 g.").
    format: `${width} cm · ${length} m · ${Number.parseInt(details.fr, 10)} µm`,
    details,
    sourcePdf: SUPPLIER_PDF.film,
    sourceDesignation,
    reason: 'Format officiel absent du site',
  })),
  ...(
    [
      [
        'p-fk-aluminium-45cm-100m',
        100,
        'Rouleau Papier Aluminium, largeur 45cm, longueur 100 mètres',
      ],
      [
        'p-fk-aluminium-45cm-150m',
        150,
        'Rouleau Papier Aluminium, largeur 45cm, longueur 150 mètres',
      ],
    ] as const
  ).map(([id, length, sourceDesignation]): CatalogAddition => ({
    id,
    slug: `catalogue-rouleau-papier-aluminium-45cm-${length}m`,
    categoryId: 'packaging',
    subcategoryId: 'trays-containers',
    name: {
      fr: `Rouleau papier aluminium alimentaire, l 45cm - L ${length}m`,
      en: `Food aluminium foil roll, w 45 cm - L ${length} m`,
    },
    format: `45 cm · ${length} m`,
    sourcePdf: SUPPLIER_PDF.film,
    sourceDesignation,
    reason: 'Format officiel absent du site',
  })),

  // Pailles
  {
    id: 'p-fk-paille-papier-230x8',
    slug: 'catalogue-paille-en-papier-230mm-x-8mm',
    categoryId: 'packaging',
    subcategoryId: 'straws',
    name: { fr: 'Paille en papier 230mm x 8mm', en: 'Paper straw 230 mm × 8 mm' },
    format: '230 mm · 8 mm',
    packQuantity: 1050,
    details: {
      fr: 'Existe en blanc, noir, blanc rayé rouge ou blanc rayé vert.',
      en: 'Available in white, black, white with red stripes or white with green stripes.',
    },
    sourcePdf: SUPPLIER_PDF.straws,
    sourceDesignation:
      'PAILLE EN PAPIER 230MM X 8MM (Existe en blanc, noir, blanc rayée en rouge ou vert)',
    reason: 'Référence officielle absente du site',
  },
  {
    id: 'p-fk-paille-noire-petit-modele-130x8',
    slug: 'catalogue-paille-noire-petit-modele-130mm-x-8mm',
    categoryId: 'packaging',
    subcategoryId: 'straws',
    name: {
      fr: 'Paille noire petit modèle 130mm x 8mm',
      en: 'Black straw, small model 130 mm × 8 mm',
    },
    format: '130 mm · 8 mm',
    packQuantity: 900,
    sourcePdf: SUPPLIER_PDF.straws,
    sourceDesignation: 'PAILLE NOIRE PETIT MODELE 130MM X 8MM',
    reason: 'Référence officielle absente du site',
  },
  {
    id: 'p-fk-paille-noire-smoothie-210x10',
    slug: 'catalogue-paille-noire-smoothie-210mm-x-10mm',
    categoryId: 'packaging',
    subcategoryId: 'straws',
    name: { fr: 'Paille noire smoothie 210mm x 10mm', en: 'Black smoothie straw 210 mm × 10 mm' },
    format: '210 mm · 10 mm',
    packQuantity: 1000,
    sourcePdf: SUPPLIER_PDF.straws,
    sourceDesignation: 'PAILLE NOIRE SMOOTHIE 210 MM X 10MM',
    reason: 'Référence officielle absente du site',
  },

  // Produits asiatiques
  {
    id: 'p-fk-baguette-chinoise-enveloppee-21cm',
    slug: 'catalogue-baguette-chinoise-enveloppee-21cm',
    categoryId: 'packaging',
    subcategoryId: 'picks',
    brandId: 'caterware',
    name: { fr: 'Baguette chinoise enveloppée 21cm', en: 'Wrapped chopsticks 21 cm' },
    format: '21 cm',
    packQuantity: 100,
    sourcePdf: SUPPLIER_PDF.asian,
    sourceDesignation: 'BAGUETTE CHINOISE ENVELOPPÉE 21cm · CATERWARE · colisage 100',
    reason: 'Référence officielle absente du site',
  },

  // Verrines
  {
    id: 'p-fk-bateau-ovale-5-7x9',
    slug: 'catalogue-bateau-ovale-5-7cm-x-9cm',
    categoryId: 'packaging',
    subcategoryId: 'verrines',
    name: { fr: 'Bateau ovale 5.7cm x 9cm', en: 'Oval boat 5.7 × 9 cm' },
    format: '5.7 cm · 9 cm',
    packQuantity: 100,
    sourcePdf: SUPPLIER_PDF.verrines,
    sourceDesignation: 'BATEAU OVAL 5.7 x 9 CM · 100 PIECES',
    reason: 'Format officiel absent du site (7 × 12 et 8 × 13,5 présents)',
  },

  // Piques
  ...(
    [
      [
        'p-fk-pique-beige-3x12',
        'pique-beige-3cm-x-12cm',
        'Pique beige 3cm x 12cm',
        'Beige pick 3 × 12 cm',
        '12 cm',
        'Pics Beige 3cm X 12cm',
      ],
      [
        'p-fk-pique-boule-rose-3x12',
        'pique-boule-rose-3cm-x-12cm',
        'Pique boule rose 3cm x 12cm',
        'Pink ball pick 3 × 12 cm',
        '12 cm',
        'Pics boule rose 3cm x 12cm',
      ],
      [
        'p-fk-pique-scelle-9cm',
        'pique-scelle-9cm',
        'Pique scellé 9cm',
        'Seal pick 9 cm',
        '9 cm',
        'Pics Scellé 9cm',
      ],
      [
        'p-fk-pique-trident-9cm',
        'pique-trident-9cm',
        'Pique trident 9cm',
        'Trident pick 9 cm',
        '9 cm',
        'Pics trident 9cm',
      ],
      ['p-fk-pique-cloche', 'pique-cloche', 'Pique cloche', 'Bell pick', '', 'Pics cloche x 100'],
      [
        'p-fk-pique-coquillage',
        'pique-coquillage',
        'Pique coquillage',
        'Seashell pick',
        '',
        'Pics coquillage',
      ],
    ] as const
  ).map(([id, slug, fr, en, format, sourceDesignation]): CatalogAddition => ({
    id,
    slug: `catalogue-${slug}`,
    categoryId: 'packaging',
    subcategoryId: 'picks',
    name: { fr, en },
    ...(format ? { format } : {}),
    packQuantity: 100,
    sourcePdf: SUPPLIER_PDF.picks,
    sourceDesignation,
    reason: 'Référence officielle absente du site',
  })),

  // Polycarbonate
  {
    id: 'p-fk-verre-a-pied-polycarbonate-295ml',
    slug: 'catalogue-verre-a-pied-en-polycarbonate-295ml',
    categoryId: 'packaging',
    subcategoryId: 'glassware',
    name: { fr: 'Verre à pied en polycarbonate 295ml', en: 'Polycarbonate stemmed glass 295 ml' },
    format: '295 ml',
    reference: 'P/PCG-16',
    sourcePdf: SUPPLIER_PDF.polycarbonate,
    sourceDesignation: 'P/PCG-16 Verre à pied en polycarbonate 295ml',
    reason: 'Référence officielle absente du site',
  },
  {
    id: 'p-fk-verre-polycarbonate-250ml-transparent',
    slug: 'catalogue-verre-en-polycarbonate-250ml-transparent',
    categoryId: 'packaging',
    subcategoryId: 'glassware',
    name: {
      fr: 'Verre en polycarbonate 250ml - transparent',
      en: 'Polycarbonate glass 250 ml, clear',
    },
    format: '250 ml',
    reference: 'P/PCG-11-T',
    sourcePdf: SUPPLIER_PDF.polycarbonate,
    sourceDesignation: 'P/PCG-11-T Verre en polycarbonate 250ml',
    reason: 'Seule couleur 250 ml absente du site après audit des références',
  },

  // Hygiène
  ...(
    [
      [
        'p-fk-bonnet-de-douche',
        'bonnet-de-douche',
        'headwear',
        'Bonnet de douche',
        'Shower cap',
        '',
        100,
        'Bonnet de douche',
        undefined,
      ],
      [
        'p-fk-gant-de-menage',
        'gant-de-menage-l-m',
        'gloves',
        'Gant de ménage L / M',
        'Household glove L / M',
        'L / M',
        12,
        'Gant de ménage L / M',
        undefined,
      ],
      [
        'p-fk-tablier-polyethylene',
        'tablier-en-polyethylene',
        'aprons-sleeves',
        'Tablier en polyéthylène',
        'Polyethylene apron',
        '',
        100,
        'Tablier en Polyéthylène',
        undefined,
      ],
      [
        'p-fk-sur-chaussure-pvc',
        'sur-chaussure-pvc-l-xl',
        'footwear',
        'Sur chaussure PVC L & XL',
        'PVC overshoe L & XL',
        'L & XL',
        100,
        'Sur chaussure PVC L & X L · Rupture provisoire',
        0,
      ],
      [
        'p-fk-combinaison',
        'combinaison',
        'aprons-sleeves',
        'Combinaison',
        'Coverall',
        '',
        100,
        'Combinaison · Rupture provisoire',
        0,
      ],
    ] as const
  ).map(
    ([
      id,
      slug,
      subcategoryId,
      fr,
      en,
      format,
      packQuantity,
      sourceDesignation,
      stockQuantity,
    ]): CatalogAddition => ({
      id,
      slug: `catalogue-${slug}`,
      categoryId: 'hygiene',
      subcategoryId,
      name: { fr, en },
      ...(format ? { format } : {}),
      packQuantity,
      ...(stockQuantity === 0 ? { stockQuantity: 0, details: RUPTURE } : {}),
      sourcePdf: SUPPLIER_PDF.hygiene,
      sourceDesignation,
      reason: 'Référence officielle absente du site',
    }),
  ),
];

// ---------------------------------------------------------------------------
// Application

const LABEL: Record<CategoryId, LocalizedText> = {
  food: { fr: 'produit agro-alimentaire professionnel', en: 'professional food-service product' },
  monin: { fr: 'référence MONIN', en: 'MONIN reference' },
  packaging: { fr: 'article d’emballage professionnel', en: 'professional packaging product' },
  hygiene: { fr: 'produit d’hygiène professionnel', en: 'professional hygiene product' },
};

const INDUSTRIES: Record<CategoryId, readonly IndustryId[]> = {
  food: ['restaurants', 'hotels', 'retail', 'food-production'],
  monin: ['restaurants', 'hotels', 'retail'],
  packaging: ['restaurants', 'hotels', 'retail', 'food-production'],
  hygiene: ['restaurants', 'hotels', 'healthcare', 'pharmaceutical', 'food-production'],
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A new product's photographs: those the owner uploaded (already on ImageKit),
 * else the client photographs matched to it, prepared under /img/products/catalogue.
 */
function catalogImagesOf(id: string): { src: string; width: number; height: number }[] {
  const match = CATALOG_IMAGES[id];
  if (!match) return [];
  if (match.hosted?.length) {
    return match.hosted.map((image) => ({
      src: image.src,
      width: image.width ?? 800,
      height: image.height ?? 800,
    }));
  }
  return match.sources.map((_, index) => ({
    src: `/img/products/catalogue/${match.file}${index ? `-${index + 1}` : ''}.v2.webp`,
    width: 800,
    height: 800,
  }));
}

function additionToProduct(addition: CatalogAddition): Product {
  const { id, name, format, categoryId } = addition;
  const label = LABEL[categoryId];
  const formatFr = format ? ` Format : ${format}.` : '';
  const formatEn = format ? ` Format: ${format}.` : '';
  const detailsFr = addition.details ? ` ${addition.details.fr}` : '';
  const detailsEn = addition.details ? ` ${addition.details.en}` : '';
  const formats: ProductFormat[] =
    format || addition.packQuantity
      ? [
          {
            id: `${id}-f1`,
            value: format || `Pack de ${addition.packQuantity}`,
            ...(addition.packQuantity ? { packQuantity: addition.packQuantity } : {}),
            ...(addition.reference ? { reference: addition.reference } : {}),
          },
        ]
      : [];

  return {
    id,
    slug: addition.slug,
    name,
    shortDescription: {
      fr: `${capitalize(label.fr)} pour les restaurants, hôtels et professionnels.${formatFr}${detailsFr}`,
      en: `${capitalize(label.en)} for restaurants, hotels and food-service professionals.${formatEn}${detailsEn}`,
    },
    description: {
      fr: `${name.fr} fait partie de notre catalogue professionnel.${formatFr}${detailsFr} La disponibilité et les délais sont confirmés sur demande.`,
      en: `${name.en} is part of our professional catalogue.${formatEn}${detailsEn} Availability and lead times are confirmed on request.`,
    },
    categoryId,
    subcategoryId: addition.subcategoryId,
    ...(addition.brandId ? { brandId: addition.brandId } : {}),
    industries: INDUSTRIES[categoryId],
    formats,
    // Only a photograph matched with certainty to this exact product and
    // format (catalog-images.data.ts); otherwise none, and the card and the
    // detail page show the shared placeholder.
    images: catalogImagesOf(id).map((image) => ({
      ...image,
      alt: { fr: `${name.fr} — photographie du produit`, en: `${name.en} — product photograph` },
    })),
    featured: false,
    seo: {
      title: { fr: name.fr, en: name.en },
      description: {
        fr: `${capitalize(label.fr)} disponible auprès de Catering Tunisie.`,
        en: `${capitalize(label.en)} available through Catering Tunisia.`,
      },
    },
  };
}

/**
 * Rewrites one record's identity. Descriptions, SEO copy and image alt text
 * embed the old name and format verbatim, so they are updated by replacing
 * those exact strings rather than regenerated from a template the record may
 * not have come from.
 */
function applyCorrection(product: Product, correction: CatalogCorrection): Product {
  const replacements: [string, string][] = [
    [product.name.fr, correction.name.fr],
    [product.name.en, correction.name.en],
  ];
  const oldFormat = product.formats[0]?.value;
  if (correction.format && oldFormat) replacements.push([oldFormat, correction.format]);
  const rewrite = (text: string): string =>
    replacements.reduce((value, [from, to]) => (from ? value.split(from).join(to) : value), text);
  const localized = (text: LocalizedText): LocalizedText => ({
    fr: rewrite(text.fr),
    en: rewrite(text.en),
  });

  const first = product.formats[0];
  const formats: ProductFormat[] =
    correction.format || correction.reference
      ? [
          {
            ...(first ?? { id: `${product.id}-f1` }),
            value: correction.format ?? first?.value ?? '',
            ...(correction.reference ? { reference: correction.reference } : {}),
          },
          ...product.formats.slice(1),
        ]
      : [...product.formats];

  return {
    ...product,
    name: correction.name,
    shortDescription: localized(product.shortDescription),
    description: localized(product.description),
    formats,
    images: product.images.map((image) => ({ ...image, alt: localized(image.alt) })),
    seo: {
      ...product.seo,
      title: localized(product.seo.title),
      description: localized(product.seo.description),
    },
  };
}

const REMOVED_IDS = new Set(CATALOG_REMOVALS.map((removal) => removal.id));
const CORRECTIONS_BY_ID = new Map(
  CATALOG_CORRECTIONS.map((correction) => [correction.id, correction]),
);

/**
 * The sale terms of every catalogue product the supplier lists price, keyed by
 * product id. A Vinto record keeps the lot the site already sold; an addition,
 * or a record sold one at a time, is sold by the PDF colisage.
 */
export function catalogSaleTerms(feed: readonly Product[]): ReadonlyMap<string, SupplierPricing> {
  const feedById = new Map(feed.map((product) => [product.id, product]));
  const ids = [
    ...feed.map((product) => product.id).filter((id) => !REMOVED_IDS.has(id)),
    ...CATALOG_ADDITIONS.map((addition) => addition.id),
  ];
  const terms = new Map<string, SupplierPricing>();
  for (const id of ids) {
    const pricing = supplierPricing(id, websiteLotOf(feedById.get(id)));
    if (pricing) terms.set(id, pricing);
  }
  return terms;
}

/**
 * Writes the sale lot onto the primary format, where the catalogue has always
 * kept the pack size. The physical format ("70 cl") is untouched; a product
 * with no format gets the generated "Pack de N" label the import already uses.
 */
function withSaleLot(product: Product, terms: SupplierPricing | undefined): Product {
  const lot = terms?.packQuantity;
  if (!lot) return product;
  const first = product.formats[0];
  if (first?.packQuantity === lot) return product;
  const value = !first || /^Pack de \d+$/.test(first.value) ? `Pack de ${lot}` : first.value;
  return {
    ...product,
    formats: [
      { ...(first ?? { id: `${product.id}-f1` }), value, packQuantity: lot },
      ...product.formats.slice(1),
    ],
  };
}

/** Source feeds in, supplier-reconciled catalogue out. Additions follow the feeds. */
export function applyCatalogReconciliation(
  products: readonly Product[],
  saleTerms: ReadonlyMap<string, SupplierPricing> = catalogSaleTerms(products),
): readonly Product[] {
  const reconciled = products
    .filter((product) => !REMOVED_IDS.has(product.id))
    .map((product) => {
      const correction = CORRECTIONS_BY_ID.get(product.id);
      return correction ? applyCorrection(product, correction) : product;
    });
  return [...reconciled, ...CATALOG_ADDITIONS.map(additionToProduct)].map((product) =>
    withSaleLot(product, saleTerms.get(product.id)),
  );
}
