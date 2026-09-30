// The company's supplier price lists (the 13 PDFs under
// imformations_about_products_provided_by_the_client/visuelsproduits (1)),
// transcribed line by line, and the catalogue products each line prices.
//
// These lines are the source of every published price (decision of 2026-09-29:
// the whole catalogue is priced from the supplier lists, HT). Prices are kept
// as the PDF's text ("0,120" → "0.120") and turned into integer millimes, so no
// binary fraction ever enters a price.
//
// What a price covers differs between lists and is recorded per line:
//   - 'piece': the price of one piece, bottle, can or roll; the colisage is the
//     supplier's carton (Agro, MONIN, Emballages, Gobelets, Couverts,
//     Polycarbonate, Asiatiques, Hygiène, Film/Alu, most Verrines);
//   - 'lot':   the price of the whole colisage (Pâtisserie, Pailles, Piques, and
//     the bateaux ovales and cornets of the Verrines list), e.g. dentelle Ø114
//     17,000 = 1000 pieces.

import { Product } from '../shared/models/catalog.model';
import { SUPPLIER_PDF } from './supplier-pdfs';

export type PriceBasis = 'piece' | 'lot';

/** Sale-unit codes, translated by the storefront (see PackText). */
export type UnitCode =
  | 'piece'
  | 'gobelet'
  | 'barquette'
  | 'sachet'
  | 'boite'
  | 'rouleau'
  | 'bouteille'
  | 'paire'
  | 'feuille'
  | 'bol'
  | 'pot'
  | 'paille'
  | 'pique'
  | 'sac'
  | 'can';

export interface SupplierLine {
  readonly pdf: string;
  readonly page: number;
  /** Exactly as printed, typos included. */
  readonly designation: string;
  /** Decimal text with a point, or null when the list prints none ("Rupture provisoire"). */
  readonly price: string | null;
  readonly basis: PriceBasis;
  /** Supplier colisage, in pieces. */
  readonly colisage: number;
  readonly unit: UnitCode;
  /** Only where the list prints a VAT column. */
  readonly vat?: number;
  readonly reference?: string;
  readonly brand?: string;
  readonly unavailable?: true;
}

const P = SUPPLIER_PDF;
const line = (
  pdf: string,
  page: number,
  designation: string,
  price: string | null,
  basis: PriceBasis,
  colisage: number,
  unit: UnitCode,
  extra: Partial<SupplierLine> = {},
): SupplierLine => ({ pdf, page, designation, price, basis, colisage, unit, ...extra });

// ---------------------------------------------------------------------------
// Lines

const agro = (
  page: number,
  designation: string,
  price: string,
  colisage: number,
  unit: UnitCode,
  brand: string,
) => line(P.food, page, designation, price, 'piece', colisage, unit, { vat: 19, brand });
const monin = (
  page: number,
  designation: string,
  price: string,
  colisage: number,
  unit: UnitCode = 'bouteille',
) => line(P.monin, page, designation, price, 'piece', colisage, unit, { brand: 'MONIN' });
const pack = (designation: string, price: string, colisage: number, unit: UnitCode) =>
  line(P.packaging, 1, designation, price, 'piece', colisage, unit, { vat: 19 });
const hyg = (
  page: number,
  designation: string,
  price: string | null,
  colisage: number,
  unavailable = false,
) =>
  line(
    P.hygiene,
    page,
    designation,
    price,
    'piece',
    colisage,
    'piece',
    unavailable ? { unavailable: true } : {},
  );
const pic = (page: number, designation: string, price: string, colisage: number) =>
  line(P.picks, page, designation, price, 'lot', colisage, 'pique');
const glass = (designation: string, reference: string, price: string, colisage = 50) =>
  line(P.polycarbonate, 1, designation, price, 'piece', colisage, 'piece', { reference });

export const SUPPLIER_LINES = {
  // Liste des prix Agroalimentaire 04 2026 — PV (HT), TVA 19 %, colisage
  'agro/champignons-184': agro(
    1,
    'CHAMPIGNONS EN TRANCHE EMPORIUM 1/4 · 184 GR',
    '2.850',
    24,
    'can',
    'EMPORIUM',
  ),
  'agro/champignons-425': agro(
    1,
    'CHAMPIGNONS EN TRANCHE EMPORIUM 1/2 · 425 GR',
    '4.750',
    24,
    'can',
    'EMPORIUM',
  ),
  'agro/champignons-850': agro(
    1,
    'CHAMPIGNONS EN TRANCHE EMPORIUM 1 KG · 850 GR',
    '6.700',
    12,
    'can',
    'EMPORIUM',
  ),
  'agro/mais-184': agro(1, 'MAÏS DOUX EMPORIUM 1/4 · 184 GR', '2.600', 24, 'can', 'EMPORIUM'),
  'agro/mais-425': agro(1, 'MAÏS DOUX EMPORIUM 1/2 · 425 GR', '3.750', 24, 'can', 'EMPORIUM'),
  'agro/mais-3100': agro(1, 'MAÏS DOUX EMPORIUM 3/1 · 3100 ML', '17.000', 6, 'can', 'EMPORIUM'),
  'agro/haricots-184': agro(
    1,
    'HARICOTS ROUGES EMPORIUM 1/4 · 184 GR',
    '1.850',
    24,
    'can',
    'EMPORIUM',
  ),
  'agro/haricots-400': agro(
    1,
    'HARICOTS ROUGES EMPORIUM 1/2 · 400GR',
    '3.100',
    24,
    'can',
    'EMPORIUM',
  ),
  'agro/mayonnaise': agro(
    1,
    'MAYONNAISE EN SQUEEZE MAYOR · 350 ML',
    '4.600',
    12,
    'bouteille',
    'MAYOR',
  ),
  'agro/ketchup': agro(1, 'KETCHUP EN SQUEEZE MAYOR · 350ML', '4.350', 12, 'bouteille', 'MAYOR'),
  'agro/barbecue': agro(
    1,
    'SAUCE BARBECUE EN SQUEEZE MAYOR · 350ML',
    '3.600',
    12,
    'bouteille',
    'MAYOR',
  ),
  'agro/moutarde-200': agro(
    1,
    'MOUTARDE FORTE DE DIJON · 200 GR · DIJONA',
    '3.900',
    12,
    'pot',
    'DIJONA',
  ),
  'agro/moutarde-370': agro(
    1,
    'MOUTARDE FORTE DE DIJON · 370 GR · DIJONA',
    '4.600',
    12,
    'pot',
    'DIJONA',
  ),
  'agro/moutarde-850': agro(
    1,
    'MOUTARDE FORTE DE DIJON · 850 GR · DIJONA',
    '10.100',
    6,
    'pot',
    'DIJONA',
  ),
  'agro/balsamique-250': agro(
    1,
    'VINAIGRE BALSAMIQUE DE MODENA VARVELLO · 250 ML',
    '5.400',
    12,
    'bouteille',
    'VARVELLO',
  ),
  'agro/balsamique-500': agro(
    1,
    'VINAIGRE BALSAMIQUE DE MODENA VARVELLO · 500 ML',
    '8.200',
    12,
    'bouteille',
    'VARVELLO',
  ),
  // The brand column prints "VERVELLO" on this line only; see SOURCE_CONFLICTS.
  'agro/balsamique-3l': agro(
    2,
    'VINAIGRE BALSAMIQUE DE MODENA VARVELLO · 3L',
    '35.500',
    4,
    'bouteille',
    'VERVELLO',
  ),
  'agro/creme-balsamique-250': agro(
    2,
    'CREME DE BALSAMIQUE VARVELLO · 250 ML',
    '7.100',
    6,
    'bouteille',
    'VARVELLO',
  ),
  'agro/creme-balsamique-500': agro(
    2,
    'CREME DE BALSAMIQUE VARVELLO · 500 ML',
    '12.000',
    12,
    'bouteille',
    'VARVELLO',
  ),
  // Also printed, identically, in Liste des produits asiatiques 06 2026 (cross-checked).
  'agro/soja': agro(2, 'SAUCE SOJA THAÏ PRIDE · 295 ML', '9.000', 12, 'bouteille', 'THAÏ PRIDE'),
  'agro/soja-sucree': agro(
    2,
    'SAUCE SOJA SUCRÉE THAÏ PRIDE · 295 ML',
    '10.000',
    12,
    'bouteille',
    'THAÏ PRIDE',
  ),
  'agro/sweet-chilli': agro(
    2,
    'SWEET CHILLI SAUCE THAÏ PRIDE · 295 ML',
    '8.000',
    12,
    'bouteille',
    'THAÏ PRIDE',
  ),
  'agro/gingembre': agro(
    2,
    'SAUCE GINGEMBRE THAÏ PRIDE · 295 ML',
    '9.000',
    12,
    'bouteille',
    'THAÏ PRIDE',
  ),
  'agro/huitres': agro(
    2,
    "SAUCE D'HUITRES THAI PRIDE · 295 ML",
    '9.000',
    12,
    'bouteille',
    'THAÏ PRIDE',
  ),
  'agro/sriracha': agro(
    2,
    'SRIRACHA HOT CHILLI SAUCE THAÏ PRIDE · 200ML',
    '10.000',
    12,
    'bouteille',
    'THAÏ PRIDE',
  ),

  // Liste des Prix Monin 05 2026 — PV Unitaire (HT), colisage
  'monin/grenadine-70': monin(1, 'Sirop de Grenadine 70cl', '27.406', 6),
  'monin/citron-vert-70': monin(1, 'Sirop de Citron vert 70cl', '23.710', 6),
  'monin/rose-70': monin(1, 'Sirop de Rose 70cl', '23.710', 6),
  'monin/pasteque-70': monin(1, 'Sirop Pasteque 70cl', '27.406', 6),
  'monin/hibiscus-70': monin(1, 'Sirop Hibiscus 70cl', '30.695', 6),
  'monin/tiramisu-70': monin(1, 'Sirop Tiramisu 70cl', '27.406', 6),
  'monin/melon-70': monin(1, 'Sirop Melon 70cl', '27.406', 6),
  'monin/orange-70': monin(1, 'Sirop Orange 70cl', '29.500', 6),
  'monin/brownies-70': monin(1, 'Sirop Brownies 70cl', '29.500', 6),
  'monin/noix-de-coco-70': monin(1, 'Sirop Noix De Coco 70cl', '23.848', 6),
  'monin/barbe-a-papa-70': monin(1, 'Sirop Barbe à Papa 70cl', '30.695', 6),
  'monin/menthe-glaciale-70': monin(1, 'Sirop Menthe Glaciale 70cl', '23.848', 6),
  'monin/pamplemousse-rose-70': monin(1, 'Sirop Pamplemousse Rose 70cl', '29.000', 6),
  'monin/lime-juice-70': monin(1, 'Sirop de Lime Juice Cordial 70cl', '23.710', 6),
  'monin/curacao-70': monin(1, 'Sirop Curaçao Blue 70cl', '25.000', 6),
  'monin/cookies-70': monin(1, 'Sirop cookies 70cl', '29.000', 6),
  'monin/gingembre-70': monin(1, 'Sirop gingembre 70cl', '29.000', 6),
  'monin/pomme-verte-70': monin(1, 'Sirop Pomme verte 70cl', '31.938', 6),
  'monin/pop-corn-70': monin(1, 'Sirop Pop Corn 70cl', '29.800', 6),
  'monin/noisettes-grillees-70': monin(1, 'Sirop Noisettes grillées 70cl', '29.000', 6),
  'monin/caramel-sale-70': monin(1, 'Sirop caramel salée 70cl', '29.000', 6),
  'monin/speculos-70': monin(1, 'Sirop Speculos 70cl', '29.000', 6),
  'monin/toffee-nut-70': monin(1, 'Sirop Toffee nut 70cl', '29.000', 6),
  'monin/chocolat-blanc-70': monin(1, 'Sirop Chocolat blanc 70cl', '25.000', 6),
  'monin/mure-70': monin(1, 'Sirop de mûre 70cl', '29.000', 6),
  'monin/the-framboise-70': monin(1, 'Thé Framboise 70cl', '35.285', 6),
  'monin/cerise-70': monin(1, 'Sirop Cerise 70cl', '29.000', 6),
  'monin/bubble-gum-70': monin(1, 'Sirop Bubble Gum 70cl', '25.607', 6),
  'monin/the-citron-70': monin(1, 'Thé citron 70cl', '31.000', 6),
  'monin/framboise-70': monin(1, 'Sirop de Framboise 70cl', '29.000', 6),
  'monin/mangue-70': monin(1, 'Sirop de Mangue 70cl', '30.000', 6),
  'monin/guimauve-70': monin(1, 'Sirop Guimauve Grillée 70cl (nouveau)', '29.000', 6),
  'monin/matcha-70': monin(1, 'Sirop Thé Vert Matcha 70cl (nouveau)', '42.000', 6),
  'monin/the-citron-1l': monin(1, 'Thé citron 1L', '33.605', 6),
  'monin/the-peche-1l': monin(1, 'Thé Pêche 1L', '33.605', 6),
  'monin/fraise-1l': monin(1, 'Sirop de Fraise 1L', '31.938', 6),
  'monin/vanille-1l': monin(1, 'Sirop de Vanille 1L', '31.938', 6),
  'monin/framboise-1l': monin(1, 'Sirop Framboise 1L', '31.938', 6),
  'monin/passion-1l': monin(1, 'Sirop Fruit De la Passion 1L', '31.938', 6),
  'monin/caramel-1l': monin(1, 'Sirop de Caramel 1L', '29.900', 6),
  'monin/sucre-canne-1l': monin(1, 'Sirop Sucre de Canne 1L', '19.000', 6),
  'monin/mojito-1l': monin(1, 'Sirop Mojito 1L', '33.000', 6),
  'monin/chocolat-1l': monin(1, 'Sirop chocolat 1L', '31.938', 6),
  'monin/espresso-martini-1l': monin(1, 'Le Mixeur Espresso Martini 1L (nouveau)', '38.000', 6),
  'monin/curacao-25': monin(1, 'Sirop Saveur Curaçao Bleu 25cl', '13.936', 6),
  'monin/vanille-25': monin(1, 'Sirop de Vanille 25cl', '13.936', 6),
  'monin/mojito-25': monin(1, 'Sirop Saveur Mojito Mint 25cl', '13.936', 6),
  'monin/fraise-25': monin(1, 'Sirop de Fraise 25cl', '13.936', 6),
  'monin/passion-25': monin(1, 'Sirop de Fruit de la Passion 25cl', '13.936', 6),
  'monin/coco-25': monin(1, 'Sirop Saveur Noix de Coco 25cl', '13.936', 6),
  'monin/grenadine-25': monin(1, 'Sirop de Grenadine 25cl', '13.936', 6),
  'monin/noisette-25': monin(1, 'Sirop Saveur Noisette 25cl', '13.936', 6),
  'monin/chocolat-cookie-25': monin(1, 'Sirop Saveur Chocolat Cookie 25cl', '13.936', 6),
  'monin/caramel-25': monin(1, 'Sirop Saveur Caramel 25cl', '13.936', 6),
  'monin/coffret-25': monin(
    1,
    'Coffret sirops 25cl : Mojito-Fraise-Bleu Curaçao',
    '41.100',
    1,
    'piece',
  ),
  'monin/puree-coco': monin(2, 'Purée de Noix de Coco 1L', '53.000', 4),
  'monin/puree-fraise': monin(2, 'Purée de Fraise 1L', '52.000', 4),
  'monin/puree-peche': monin(2, 'Purée de Peche 1L', '52.000', 4),
  'monin/puree-framboise': monin(2, 'Purée de Framboise 1L', '60.000', 4),
  'monin/puree-fruits-rouges': monin(2, 'Purée de Fruits Rouges 1L', '56.000', 4),
  'monin/puree-pomme-verte': monin(2, 'Purée de Pomme verte 1L', '49.000', 4),
  'monin/puree-myrtilles': monin(2, 'Purée de Myrtilles 1L', '60.000', 4),
  'monin/puree-mangue': monin(2, 'Purée de Mangue 1L', '59.000', 4),
  'monin/puree-passion': monin(2, 'Purée de Passion 1L', '57.000', 4),
  'monin/puree-banane': monin(2, 'Purée de Banane 1L', '49.000', 4),
  'monin/puree-kiwi': monin(2, 'Purée de Kiwi 1L', '53.000', 4),
  'monin/puree-lychee': monin(2, 'Purée de Lychee 1L', '55.000', 4),
  'monin/puree-ananas': monin(2, 'Purée Ananas 1L', '53.000', 4),
  'monin/puree-cassis': monin(2, 'Purée de Cassis (nouveau)', '59.000', 4),
  'monin/sauce-caramel': monin(2, 'Sauce Caramel 1,89 L', '73.000', 4),
  'monin/sauce-chocolat-noir': monin(2, 'Sauce Chocolat Noir 1,89 L', '63.525', 4),
  'monin/sauce-chocolat-blanc': monin(2, 'Sauce Chocolat Blanc 1,89 L', '64.000', 4),
  'monin/frappe-cafe-boite': monin(2, 'Frappé café boite de 1,36kg', '84.000', 4, 'boite'),
  'monin/frappe-cafe-sac': monin(2, 'Frappé café sac de 2kg', '110.000', 5, 'sac'),
  'monin/frappe-neutre-boite': monin(2, 'Frappé neutre 1,36kg', '79.000', 4, 'boite'),
  'monin/frappe-neutre-sac': monin(2, 'Frappé neutre sac de 2kg', '102.000', 5, 'sac'),
  'monin/frappe-vanille-boite': monin(2, 'Frappé vanille 1,36kg', '88.000', 4, 'boite'),
  'monin/frappe-vanille-sac': monin(2, 'Frappé vanille sac de 2kg', '112.000', 5, 'sac'),
  'monin/frappe-chocolat-boite': monin(2, 'Frappé Chocolat 1,36kg', '99.000', 4, 'boite'),
  'monin/pompe-15': monin(2, 'Pompe 15ml pour sauce', '12.100', 1, 'piece'),
  'monin/pompe-10-1l': monin(2, 'Pompe 10ml pour sirop 1L', '9.900', 1, 'piece'),
  'monin/pompe-10-70': monin(2, 'Pompe 10ml pour sirop 70cl', '9.900', 1, 'piece'),
  'monin/pilon': monin(2, 'Pilon en métal', '45.000', 1, 'piece'),
  'monin/tapis': monin(2, 'Tapis de Bar en caoutchouc Monin 20/60cm', '53.900', 1, 'piece'),
  'monin/shaker': monin(2, 'Shaker boston (inox et verre)', '53.900', 1, 'piece'),
  'monin/doseur-25-50': monin(2, 'Doseur inox double face 25ml-50ml', '19.000', 1, 'piece'),
  'monin/doseur-30-60': monin(2, 'Grand doseur inox double face 30ml - 60ml', '33.000', 1, 'piece'),
  'monin/dispenser': monin(2, 'Dispenser en verre 8.5L avec robinet', '57.000', 1, 'piece'),
  'monin/presentoir': monin(2, 'Présentoir en métal (4 bouteilles)', '36.300', 1, 'piece'),
  'monin/cuillere': monin(2, 'Cuillère à cocktail en inox, L 28cm', '32.000', 1, 'piece'),
  'monin/bac-glacons': monin(2, 'Bac de stockage à glaçons 6 L', '50.000', 1, 'piece'),

  // Consommable Pâtisserie 05 2026 — PRIX (HT) of the whole colisage
  'patisserie/poche-55': line(P.pastry, 1, 'POCHE ROULEAU 55 CM', '53.000', 'lot', 100, 'piece'),
  'patisserie/poche-40': line(P.pastry, 1, 'POCHE ROULEAU 40 CM', '41.000', 'lot', 100, 'piece'),
  'patisserie/cuisson-multi': line(
    P.pastry,
    1,
    'PAPIER CUISSON multi-passages 40 cm x 60 cm · 500 FEUILLES/RAME',
    '73.000',
    'lot',
    500,
    'feuille',
  ),
  'patisserie/cuisson': line(
    P.pastry,
    1,
    'PAPIER CUISSON 40 cm x 60 cm · 500 FEUILLES/RAME',
    '60.000',
    'lot',
    500,
    'feuille',
  ),
  'patisserie/ruban-30': line(P.pastry, 1, 'RUBAN REDUITE 30 MM', '30.000', 'lot', 1, 'rouleau'),
  'patisserie/ruban-40': line(P.pastry, 1, 'RUBAN REDUITE 40 MM', '60.000', 'lot', 1, 'rouleau'),
  'patisserie/ruban-50': line(P.pastry, 1, 'RUBAN REDUITE 50 MM', '65.000', 'lot', 1, 'rouleau'),
  'patisserie/dentelle-114': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 114MM',
    '17.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-140': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 140MM',
    '23.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-165': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 165MM',
    '30.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-190': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 190MM',
    '39.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-216': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 216MM',
    '47.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-240': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 240MM',
    '57.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-265': line(
    P.pastry,
    1,
    'PAPIER DENTELLE DIAM 265MM',
    '69.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-285': line(
    P.pastry,
    2,
    'PAPIER DENTELLE DIAM 285MM',
    '74.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-305': line(
    P.pastry,
    2,
    'PAPIER DENTELLE DIAM 305MM',
    '84.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-320': line(
    P.pastry,
    2,
    'PAPIER DENTELLE DIAM 320MM',
    '92.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-360': line(
    P.pastry,
    2,
    'PAPIER DENTELLE DIAM 360MM',
    '120.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-26x36': line(
    P.pastry,
    2,
    'PAPIER DENTELLE 26 x 36,5CM',
    '87.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-30x39': line(
    P.pastry,
    2,
    'PAPIER DENTELLE 30 x 39,5CM',
    '110.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-36x44': line(
    P.pastry,
    2,
    'PAPIER DENTELLE 36 x 44CM',
    '120.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/dentelle-40x50': line(
    P.pastry,
    2,
    'PAPIER DENTELLE 40 x 50CM',
    '185.000',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/caissette-5': line(
    P.pastry,
    2,
    'CAISSETTE N °5 BLANC',
    '5.500',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/caissette-6': line(
    P.pastry,
    2,
    'CAISSETTE N °6 BLANC',
    '5.900',
    'lot',
    1000,
    'piece',
  ),
  'patisserie/caissette-7': line(
    P.pastry,
    2,
    'CAISSETTE N °7 BLANC',
    '6.200',
    'lot',
    1000,
    'piece',
  ),

  // Consommables hygiène 06-2026 TC — PV H.T per piece, colisage
  'hygiene/toque-legere': hyg(1, 'Toque Légère crépon', '1.300', 250),
  'hygiene/toque-master-chef': hyg(1, 'Toque Master Chef', '3.000', 10),
  'hygiene/toque-cambi': hyg(1, 'Toque Chef Cambi', '0.800', 25),
  'hygiene/calot': hyg(1, 'Calot Rayé Rouge-Bleu', '0.190', 100),
  'hygiene/coiffe-charlotte': hyg(1, 'Coiffe ou charlotte', '0.140', 100),
  'hygiene/gants-vinyle': hyg(1, 'Gants en vinyle S / L / M', '0.078', 100),
  'hygiene/gants-latex': hyg(1, 'Gants en latex S / M / L · Rupture provisoire', null, 100, true),
  'hygiene/gants-nitrile': hyg(1, 'Gant nitrile L/M/S · Rupture provisoire', null, 100, true),
  'hygiene/gants-pe': hyg(1, 'Gants en Polyéthylène M / L', '0.045', 100),
  'hygiene/gant-menage': hyg(1, 'Gant de ménage L / M', '1.750', 12),
  'hygiene/bonnet-douche': hyg(1, 'Bonnet de douche', '0.120', 100),
  'hygiene/coiffe-bouffant': hyg(2, 'Coiffe "Bouffant"', '0.120', 100),
  'hygiene/masque': hyg(2, 'Masque de protection 3 plis, Type 1', '0.075', 50),
  'hygiene/tablier-pe': hyg(2, 'Tablier en Polyéthylène', '0.150', 100),
  'hygiene/casquette': hyg(2, 'Casquette', '0.200', 100),
  'hygiene/sur-chaussure-pvc': hyg(
    2,
    'Sur chaussure PVC L & X L · Rupture provisoire',
    null,
    100,
    true,
  ),
  'hygiene/sur-chaussure-non-tissee': hyg(2, 'Sur chaussure non tissée', '0.150', 100),
  'hygiene/tablier-visiteur': hyg(2, 'Tablier visiteur en Polyéthylène', '1.450', 100),
  'hygiene/manchette': hyg(2, 'Manchette', '0.110', 2000),
  'hygiene/combinaison': hyg(2, 'Combinaison · Rupture provisoire', null, 100, true),
  'hygiene/blouse-non-tissee': hyg(2, 'Blouse non tissée', '4.700', 10),

  // Film étirable et Rouleau Aluminium 04-2026 — Prix Unitaire (HT) per box/roll
  'film/avec-30x300': line(
    P.film,
    1,
    'Film étirable avec Boite Distributrice, largeur 30cm, longueur 300 mètres, 9 microns, 1150gr',
    '14.200',
    'piece',
    6,
    'rouleau',
  ),
  'film/avec-45x300': line(
    P.film,
    1,
    'Film étirable avec Boite Distributrice, largeur 45cm, longueur 300 mètres, 9 microns, 1720gr',
    '21.000',
    'piece',
    6,
    'rouleau',
  ),
  'film/sans-30x50': line(
    P.film,
    1,
    'Film étirable sans Boite Distributrice, largeur 30cm, longueur 50 mètres, 9 microns',
    '3.500',
    'piece',
    6,
    'rouleau',
  ),
  'film/sans-30x100': line(
    P.film,
    1,
    'Film étirable sans Boite Distributrice, largeur 30cm, longueur 100 mètres, 9 microns',
    '5.700',
    'piece',
    6,
    'rouleau',
  ),
  'film/sans-30x300': line(
    P.film,
    1,
    'Film étirable sans Boite Distributrice, largeur 30cm, longueur 300 mètres, 9 microns, 1150gr',
    '12.800',
    'piece',
    4,
    'rouleau',
  ),
  'film/sans-45x300': line(
    P.film,
    1,
    'Film étirable sans Boite Distributrice, largeur 45cm, longueur 300 mètres, 9 microns, 1720gr',
    '19.600',
    'piece',
    4,
    'rouleau',
  ),
  'film/avec-25x1500': line(
    P.film,
    1,
    'Film étirable avec Boite Ditributrice 250 mm x 1500 mètres',
    '97.200',
    'piece',
    1,
    'rouleau',
  ),
  'film/avec-30x1500': line(
    P.film,
    1,
    'Film étirable avec Boite Distributrice 300 mm x 1500 mètres 14 micron',
    '100.000',
    'piece',
    1,
    'rouleau',
  ),
  'film/avec-45x1500': line(
    P.film,
    1,
    'Film étirable avec Boite Distributrice 450 mm x1500 mètres 12 micron',
    '141.500',
    'piece',
    1,
    'rouleau',
  ),
  'alu/30x100': line(
    P.film,
    1,
    'Rouleau Papier Aluminium, largeur 30cm, longueur 100 mètres',
    '19.200',
    'piece',
    6,
    'rouleau',
  ),
  'alu/45x100': line(
    P.film,
    1,
    'Rouleau Papier Aluminium, largeur 45cm, longueur 100 mètres',
    '36.800',
    'piece',
    6,
    'rouleau',
  ),
  'alu/45x150': line(
    P.film,
    1,
    'Rouleau Papier Aluminium, largeur 45cm, longueur 150 mètres',
    '46.000',
    'piece',
    6,
    'rouleau',
  ),

  // Gobelets PET & PAPIER & EPS 04 2022 — PRIX (HT) per piece, colisage
  'gobelets/pet-12': line(
    P.cups,
    1,
    'GOBELET PET 12OZ/350 ML TRANSPARENT',
    '0.195',
    'piece',
    1000,
    'gobelet',
  ),
  'gobelets/pet-16': line(
    P.cups,
    1,
    'GOBLET PET 16OZ/450 ML TRANSPARENT',
    '0.220',
    'piece',
    1000,
    'gobelet',
  ),
  'gobelets/couvercle-pet-avec-trou': line(
    P.cups,
    1,
    'COUVERCLE DOM PET 350ml/450ml AVEC TROU',
    '0.095',
    'piece',
    1000,
    'piece',
  ),
  'gobelets/couvercle-pet-sans-trou': line(
    P.cups,
    1,
    'COUVERCLE DOM PET 255ml/350ml/450ml SANS TROU',
    '0.095',
    'piece',
    1000,
    'piece',
  ),
  'gobelets/pet-9': line(
    P.cups,
    1,
    'GOBELET PET 9OZ/255ML TRANSPARENT',
    '0.190',
    'piece',
    1000,
    'gobelet',
  ),
  'gobelets/papier-125': line(
    P.cups,
    1,
    'GOBELET EN PAPIER SENSO 125ml (importé)',
    '0.048',
    'piece',
    2000,
    'gobelet',
  ),
  'gobelets/bol-eps-8': line(P.cups, 1, 'BOL EN EPS 8OZ/240ml', '0.150', 'piece', 500, 'bol'),
  'gobelets/couvercle-pp-8': line(
    P.cups,
    1,
    'COUVERCLE PP POUR BOL EPS 8OZ',
    '0.070',
    'piece',
    500,
    'piece',
  ),
  'gobelets/eps-7': line(P.cups, 2, 'GOBELET EPS 7OZ / 200ML', '0.070', 'piece', 1000, 'gobelet'),
  'gobelets/couvercle-ps-7': line(
    P.cups,
    2,
    'COUVERCLE PS POUR GOBELET 7OZ',
    '0.035',
    'piece',
    1000,
    'piece',
  ),
  'gobelets/eps-12': line(P.cups, 2, 'GOBELET EPS 12OZ / 350ML', '0.085', 'piece', 1000, 'gobelet'),
  'gobelets/couvercle-ps-12': line(
    P.cups,
    2,
    'COUVERCLE PS POUR GOBELET 12OZ',
    '0.040',
    'piece',
    1000,
    'piece',
  ),
  'gobelets/eps-16': line(P.cups, 2, 'GOBELET EPS 16OZ / 450ML', '0.095', 'piece', 800, 'gobelet'),
  'gobelets/couvercle-ps-16': line(
    P.cups,
    2,
    'COUVERCLE PS POUR GOBELET 16OZ',
    '0.045',
    'piece',
    1000,
    'piece',
  ),

  // Liste des Couverts jetables 08 2022 — PRIX UNITAIRE (HT), carton
  'couverts/couteau-plastique': line(
    P.cutlery,
    1,
    'COUTEAU EN PLASTIQUE TRANSPARENT (GAMME LUX)',
    '0.070',
    'piece',
    2000,
    'piece',
  ),
  'couverts/fourchette-plastique': line(
    P.cutlery,
    1,
    'FOURCHETTE EN PLASTIQUE TRANSPARENT (GAMME LUX)',
    '0.070',
    'piece',
    2000,
    'piece',
  ),
  'couverts/cuillere-plastique': line(
    P.cutlery,
    1,
    'CUILLERE EN PLASTIQUE TRANSPARENT (GAMME LUX)',
    '0.070',
    'piece',
    2000,
    'piece',
  ),
  'couverts/petite-cuillere-plastique': line(
    P.cutlery,
    1,
    'PETITE CUILLERE EN PLASTIQUE TRANSPARENT (GAMME LUX)',
    '0.037',
    'piece',
    2000,
    'piece',
  ),
  'couverts/fourchette-bois': line(
    P.cutlery,
    1,
    'FOURCHETTE EN BOIS',
    '0.090',
    'piece',
    1000,
    'piece',
  ),
  'couverts/couteau-bois': line(P.cutlery, 1, 'COUTEAU EN BOIS', '0.090', 'piece', 1000, 'piece'),
  'couverts/cuillere-bois': line(P.cutlery, 1, 'CUILLERE EN BOIS', '0.090', 'piece', 1000, 'piece'),
  'couverts/cuillere-dessert-bois': line(
    P.cutlery,
    1,
    'CUILLERE A DESSERT EN BOIS',
    '0.070',
    'piece',
    3000,
    'piece',
  ),

  // Liste des emballages alimentaires 06 2026 — Prix unitaire (HT), TVA 19 %
  'emballages/soupe-kraft-500': pack(
    'Bol à soupe 500ml en kraft avec couvercle',
    '1.046',
    500,
    'bol',
  ),
  'emballages/soupe-kraft-1000': pack(
    'Bol à soupe 1000ml en kraft avec couvercle',
    '1.346',
    500,
    'bol',
  ),
  'emballages/soupe-blanc-500': pack(
    'Bol à soupe en carton blanc 500ml avec couvercle',
    '1.072',
    500,
    'bol',
  ),
  'emballages/soupe-blanc-1100': pack(
    'Bol à soupe en carton blanc 1100ml avec couvercle',
    '1.350',
    500,
    'bol',
  ),
  'emballages/salade-kraft-500': pack(
    'Bol à salade 500ml en kraft brun avec couvercle PET',
    '0.889',
    300,
    'bol',
  ),
  'emballages/salade-kraft-1100': pack(
    'Bol à salade 1100ml en kraft brun avec couvercle PET',
    '1.307',
    300,
    'bol',
  ),
  'emballages/salade-blanc-500': pack(
    'Bol à salade 500ml en carton blanc avec couvercle PET',
    '0.915',
    300,
    'bol',
  ),
  'emballages/salade-blanc-1100': pack(
    'Bol à salade 1100ml en carton blanc avec couvercle PET',
    '1.320',
    300,
    'bol',
  ),
  'emballages/fritures-220': pack(
    'Barquette pour fritures 220ml en kraft',
    '0.218',
    1000,
    'barquette',
  ),
  'emballages/fritures-400': pack(
    'Barquette pour fritures 400ml en kraft',
    '0.335',
    1000,
    'barquette',
  ),
  'emballages/poche-frites-pm': pack('Poche à frites en kraft PM', '0.380', 1000, 'piece'),
  'emballages/poche-frites-mm': pack('Poche à frites en kraft MM', '0.460', 1000, 'piece'),
  'emballages/pochette-frites': pack('Pochette frites en kraft', '0.366', 1000, 'piece'),
  'emballages/pochette-frites-sauces': pack(
    'Pochette frites et sauces en kraft',
    '0.510',
    500,
    'piece',
  ),
  'emballages/pot-pate': pack('Pot à pâte en Kraft 950ml', '0.900', 500, 'pot'),
  'emballages/hamburger-moyenne': pack('Boite à Hamburger Moyenne en kraft', '0.706', 300, 'boite'),
  'emballages/hamburger-gm': pack('Boite à Hamburger GM en kraft', '0.900', 200, 'boite'),
  'emballages/micro-2': pack(
    'Barquette Repas micro-ondable deux compartiments',
    '0.800',
    200,
    'barquette',
  ),
  'emballages/micro-3': pack(
    'Barquette Repas micro-ondable trois compartiments',
    '0.800',
    200,
    'barquette',
  ),
  // Also printed, identically, in Liste des produits asiatiques 06 2026 (cross-checked).
  'emballages/sushi-170': pack('Barquette à sushi 170x122x30mm', '0.350', 800, 'barquette'),
  'emballages/sushi-193': pack('Barquette à sushi 193x137x30mm', '0.450', 600, 'barquette'),
  'emballages/sushi-224': pack('Barquette à sushi 224x142x30mm', '0.750', 500, 'barquette'),
  'emballages/pot-sauce-30': pack('Pot à sauce 1oz/30ml', '0.110', 1000, 'pot'),
  'emballages/pot-sauce-60': pack('Pot à sauce 2oz/60ml', '0.130', 1000, 'pot'),

  // Liste des pailles 08 2024 — Prix (HT) of the whole colisage
  'pailles/papier': line(
    P.straws,
    1,
    'PAILLE EN PAPIER 230MM X 8MM (Existe en blanc, noir, blanc rayée en rouge ou vert)',
    '57.700',
    'lot',
    1050,
    'paille',
  ),
  'pailles/cuillere': line(
    P.straws,
    1,
    'PAILLE CUILLERE 210MM X 6MM',
    '27.000',
    'lot',
    1000,
    'paille',
  ),
  'pailles/noire-petit': line(
    P.straws,
    1,
    'PAILLE NOIRE PETIT MODELE 130MM X 8MM',
    '11.000',
    'lot',
    900,
    'paille',
  ),
  'pailles/noire-smoothie': line(
    P.straws,
    1,
    'PAILLE NOIRE SMOOTHIE 210 MM X 10MM',
    '33.000',
    'lot',
    1000,
    'paille',
  ),
  'pailles/bubble': line(
    P.straws,
    1,
    'PAILLE BUBBLE SMOOTHIE 200MM X 12MM',
    '50.000',
    'lot',
    1000,
    'paille',
  ),
  'pailles/noire-enveloppee': line(
    P.straws,
    1,
    'PAILLE NOIRE ENVELOPPEE 220MM X 8MM',
    '35.000',
    'lot',
    1000,
    'paille',
  ),
  'pailles/noire': line(P.straws, 1, 'PAILLE NOIRE 220MM X 8MM', '27.000', 'lot', 1000, 'paille'),
  'pailles/simple': line(P.straws, 1, 'PAILLE SIMPLE 220MM X 8MM', '23.000', 'lot', 1000, 'paille'),
  'pailles/flexible': line(
    P.straws,
    1,
    'PAILLE FLEXIBLE 220MM X 8MM',
    '30.000',
    'lot',
    1000,
    'paille',
  ),

  // Liste des prix Verre en polycarbonate 06 2023 — Prix HT per glass, colisage
  'poly/250-t': glass('Verre en polycarbonate 250ml', 'P/PCG-11-T', '3.353'),
  'poly/250-b': glass('Verre en polycarbonate 250ml - fond bleu', 'P/PCG-11-B', '3.353'),
  'poly/250-v': glass('Verre en polycarbonate 250ml - fond vert', 'P/PCG-11-V', '3.353'),
  'poly/250-m': glass('Verre en polycarbonate 250ml - fond violet', 'P/PCG-11-M', '3.353'),
  'poly/250-j': glass('Verre en polycarbonate 250ml - fond jaune', 'P/PCG-11-J', '3.353'),
  'poly/250-r': glass('Verre en polycarbonate 250ml - fond rouge', 'P/PCG-11-R', '3.353'),
  'poly/295': glass('Verre à pied en polycarbonate 295ml', 'P/PCG-16', '3.353'),
  // Printed "4,29" (two decimals) on this line only; read as 4,290 like its siblings.
  'poly/300-j': glass('Verre en polycarbonate 300ml - fond jaune', 'P/PCG12-J', '4.290'),
  'poly/300-m': glass('Verre en polycarbonate 300ml - fond violet', 'P/PCG12-M', '4.290'),
  'poly/300-t': glass('Verre en polycarbonate 300ml', 'P/PCG12-T', '4.290'),
  'poly/300-r': glass('Verre en polycarbonate 300ml - fond rouge', 'P/PCG12-R', '4.290'),
  'poly/300-v': glass('Verre en polycarbonate 300ml - fond vert', 'P/PCG12-V', '4.290'),
  'poly/biere-400': glass('Verre à Bière en polycarbonate 400cc', 'G/2882', '3.630', 80),
  'poly/400-j': glass('Verre en polycarbonate 400ml - fond jaune', 'P/PCG13-J', '4.976'),
  'poly/chope-500': glass('Chope à Bière en polycarbonate 500ml', 'P/PCG-18', '6.692', 24),

  // Liste des produits asiatiques 06 2026 — PV UNITAIRE (HT), TVA 19 %
  'asiatique/baguette': line(
    P.asian,
    1,
    'BAGUETTE CHINOISE ENVELOPPÉE 21cm · CATERWARE',
    '0.100',
    'piece',
    100,
    'paire',
    { vat: 19, brand: 'CATERWARE' },
  ),
  'asiatique/brochette-20': line(
    P.asian,
    1,
    'BROCHETTE EN BAMBOO 20CM · CATERWARE',
    '0.028',
    'piece',
    1000,
    'piece',
    { vat: 19, brand: 'CATERWARE' },
  ),
  'asiatique/brochette-25': line(
    P.asian,
    1,
    'BROCHETTE EN BAMBOO 25CM · CATERWARE',
    '0.034',
    'piece',
    1000,
    'piece',
    { vat: 19, brand: 'CATERWARE' },
  ),

  // Liste des verrines 03 2026 — Prix HT per piece, except bateaux and cornets (per 100)
  'verrines/assida': line(
    P.verrines,
    1,
    'VERRINE COUPE ASSIDA 200CC AVEC COUVERCLE',
    '0.430',
    'piece',
    630,
    'piece',
  ),
  'verrines/coupe-base-70': line(
    P.verrines,
    1,
    'VERRINE COUPE AVEC BASE 70 ML',
    '0.450',
    'piece',
    100,
    'piece',
  ),
  'verrines/rond-carree-60': line(
    P.verrines,
    1,
    'VERRINE ROND-CARRÉE 60 ML',
    '0.290',
    'piece',
    1200,
    'piece',
  ),
  'verrines/felicita-50': line(
    P.verrines,
    1,
    'VERRINE FELICITA 50 ML',
    '0.290',
    'piece',
    1440,
    'piece',
  ),
  'verrines/tube-70': line(
    P.verrines,
    1,
    'VERRINE TUBE 70 ML TRANSPARENTE',
    '0.480',
    'piece',
    1000,
    'piece',
  ),
  'verrines/cylindre-50': line(
    P.verrines,
    1,
    'VERRINE CYLINDRE 50 ML',
    '0.250',
    'piece',
    300,
    'piece',
  ),
  'verrines/cylindre-80': line(
    P.verrines,
    1,
    'VERRINE CYLINDRE 80 ML',
    '0.390',
    'piece',
    300,
    'piece',
  ),
  'verrines/cube-50': line(P.verrines, 1, 'VERRINE CUBE 50 ML', '0.300', 'piece', 1000, 'piece'),
  'verrines/cube-100': line(P.verrines, 1, 'VERRINE CUBE 100 ML', '0.380', 'piece', 1000, 'piece'),
  'verrines/cube-150': line(P.verrines, 1, 'VERRINE CUBE 150 ML', '0.430', 'piece', 1000, 'piece'),
  'verrines/couvercle-cube-150': line(
    P.verrines,
    1,
    'COUVERCLE VERRINE CUBE 150 ML',
    '0.100',
    'piece',
    1000,
    'piece',
  ),
  'verrines/goutte-11': line(
    P.verrines,
    1,
    'VERRINE GOUTTE 11 ML TRASNPARENTE / NOIRE',
    '0.260',
    'piece',
    1000,
    'piece',
  ),
  'verrines/cuillere-chinoise': line(
    P.verrines,
    2,
    'CUILLERE CHINOISE 15CC',
    '0.220',
    'piece',
    30,
    'piece',
  ),
  'verrines/fourchette': line(P.verrines, 2, 'FOURCHETTE VERRINE', '0.105', 'piece', 1000, 'piece'),
  'verrines/cuillere': line(P.verrines, 2, 'CUILLERE VERRINE', '0.105', 'piece', 1000, 'piece'),
  'verrines/bateau-8x13': line(
    P.verrines,
    2,
    'BATEAU OVAL 8 x 13.5 CM',
    '23.000',
    'lot',
    100,
    'piece',
  ),
  'verrines/bateau-7x12': line(
    P.verrines,
    2,
    'BATEAU OVAL 7 x 12 CM',
    '19.000',
    'lot',
    100,
    'piece',
  ),
  'verrines/bateau-5x9': line(
    P.verrines,
    2,
    'BATEAU OVAL 5.7 x 9 CM',
    '13.000',
    'lot',
    100,
    'piece',
  ),
  'verrines/cornet-15': line(P.verrines, 2, 'CORNET 15 CM', '16.300', 'lot', 100, 'piece'),
  'verrines/cornet-13': line(P.verrines, 2, 'CORNET 13 CM', '14.000', 'lot', 100, 'piece'),

  // Piques 06 2025 — Prix HT of the whole colisage ("Colisage en pièce")
  'piques/etoile-rose-vert': pic(1, 'Pics étoiles rose&vert 12cm', '12.000', 100),
  'piques/bois-vert-9': pic(1, 'Pics en bois vert 9cm', '69.000', 1000),
  'piques/bois-vert-12': pic(1, 'Pics en bois vert 12cm', '77.000', 1000),
  'piques/bois-vert-15': pic(1, 'Pics en bois vert 15cm', '99.000', 1000),
  'piques/bois-18': pic(1, 'Pics en bois 18cm', '103.000', 1000),
  // Same article as the asiatiques line (0,100 HT the pair, colisage 100): consistent.
  'piques/baguette': pic(1, 'Baguette chinoise enveloppée 21cm', '10.000', 100),
  'piques/bamboo-doigt': pic(1, 'Pics Bamboo Doigt 9cm', '24.000', 100),
  'piques/beige': pic(1, 'Pics Beige 3cm X 12cm', '12.000', 100),
  'piques/rouge-noir': pic(1, 'Pics Rouge Noir 2cm X 12cm', '12.000', 100),
  'piques/vert-noir': pic(1, 'Pics Vert Noir 2cm X 12cm', '12.000', 100),
  'piques/boule-bleue': pic(2, 'Pics boule bleue 3cm x 12cm', '14.000', 100),
  'piques/boule-rouge': pic(2, 'Pics boule rouge 3cm x 12cm', '14.000', 100),
  'piques/boule-rose': pic(2, 'Pics boule rose 3cm x 12cm', '14.000', 100),
  'piques/boule-orange': pic(2, 'Pics boule orange 3cm x 12cm', '14.000', 100),
  'piques/boule-jaune': pic(2, 'Pics boule jaune 3cm x 12cm', '14.000', 100),
  'piques/boule-verte': pic(2, 'Pics boule verte 3cm x 12cm', '14.000', 100),
  'piques/ciseaux': pic(2, 'Pics ciseaux 9 cm', '23.000', 100),
  'piques/2-boules-jaune': pic(2, 'Pics 2 boules jaune 2cm x 12cm', '15.000', 100),
  'piques/2-boules-rouge': pic(2, 'Pics 2 boules rouge 2cm x 12cm', '15.000', 100),
  'piques/etoile-rouge-vert': pic(2, 'Pics étoile rouge&vert 12cm', '12.000', 100),
  'piques/bamboo-9': pic(2, 'Pics Bamboo 9cm', '8.000', 100),
  'piques/bois-9': pic(2, 'Pics en Bois 9cm', '69.000', 1000),
  'piques/perle-or': pic(3, "Pics perle d'or", '15.000', 100),
  'piques/perle-satin': pic(3, 'Pics perle satin', '15.000', 100),
  'piques/plume': pic(3, 'Pics plume', '33.000', 100),
  'piques/boucle-13': pic(3, 'Pics boucle 13cm', '23.000', 100),
  'piques/scelle-9': pic(3, 'Pics Scellé 9cm', '32.000', 100),
  'piques/p-13': pic(3, 'Pics P 13cm', '14.000', 50),
  'piques/trident-9': pic(3, 'Pics trident 9cm', '32.000', 100),
  'piques/cloche': pic(3, 'Pics cloche x 100', '13.000', 100),
  'piques/sapin': pic(3, 'Pics sapin', '19.000', 100),
  'piques/coquillage': pic(3, 'Pics coquillage', '14.000', 100),
  'piques/petites-boules': pic(3, 'Pics petit boule coloré', '12.000', 100),
  'piques/brochette-20': pic(3, 'Brochette 20cm en bamboo', '28.000', 1000),
  'piques/brochette-25': pic(4, 'Brochette 25cm en bamboo', '34.000', 1000),
  'piques/cure-dents-boite': line(
    P.picks,
    4,
    'Cure dents la boite de 300pcs',
    '2.000',
    'lot',
    300,
    'boite',
  ),
  'piques/cure-dents-enveloppes': pic(4, 'Cure dents enveloppé 1000 pcs', '12.000', 1000),
} as const satisfies Record<string, SupplierLine>;

export type SupplierLineKey = keyof typeof SUPPLIER_LINES;

// ---------------------------------------------------------------------------
// Catalogue product → supplier line(s). Two lines are a bundle the site sells
// as one article (cup + lid); its price is the sum of the two PDF prices.

export const PRODUCT_SUPPLIER_LINES: Readonly<
  Record<string, SupplierLineKey | readonly SupplierLineKey[]>
> = {
  // Agro
  'p-vinto-21': 'agro/champignons-184',
  'p-fk-champignons-emporium-425g': 'agro/champignons-425',
  'p-fk-champignons-emporium-850g': 'agro/champignons-850',
  'p-vinto-25': 'agro/mais-184',
  'p-fk-mais-doux-emporium-425g': 'agro/mais-425',
  'p-fk-mais-doux-emporium-3100ml': 'agro/mais-3100',
  'p-vinto-469': 'agro/haricots-184',
  'p-fk-haricots-rouges-emporium-400g': 'agro/haricots-400',
  'p-vinto-384': 'agro/mayonnaise',
  'p-vinto-386': 'agro/ketchup',
  'p-vinto-385': 'agro/barbecue',
  'p-vinto-27': 'agro/moutarde-200',
  'p-vinto-28': 'agro/moutarde-370',
  'p-fk-moutarde-dijon-dijona-850g': 'agro/moutarde-850',
  'p-vinto-37': 'agro/balsamique-250',
  'p-vinto-36': 'agro/balsamique-500',
  'p-vinto-38': 'agro/balsamique-3l',
  'p-vinto-40': 'agro/creme-balsamique-250',
  'p-vinto-39': 'agro/creme-balsamique-500',
  'p-vinto-472': 'agro/soja',
  'p-vinto-475': 'agro/soja-sucree',
  'p-vinto-473': 'agro/sweet-chilli',
  'p-vinto-471': 'agro/gingembre',
  'p-vinto-474': 'agro/huitres',
  'p-vinto-476': 'agro/sriracha',

  // MONIN syrups
  'p-monin-320': 'monin/grenadine-70',
  'p-fk-monin-citron-vert-70cl': 'monin/citron-vert-70',
  'p-monin-164': 'monin/rose-70',
  'p-fk-monin-pasteque-70cl': 'monin/pasteque-70',
  'p-monin-312': 'monin/hibiscus-70',
  'p-monin-310': 'monin/tiramisu-70',
  'p-fk-monin-melon-70cl': 'monin/melon-70',
  'p-fk-monin-orange-70cl': 'monin/orange-70',
  'p-fk-monin-brownies-70cl': 'monin/brownies-70',
  'p-monin-170': 'monin/noix-de-coco-70',
  'p-fk-monin-barbe-a-papa-70cl': 'monin/barbe-a-papa-70',
  'p-monin-172': 'monin/menthe-glaciale-70',
  'p-monin-301': 'monin/pamplemousse-rose-70',
  'p-monin-165': 'monin/lime-juice-70',
  'p-monin-167': 'monin/curacao-70',
  'p-fk-monin-cookies-70cl': 'monin/cookies-70',
  'p-monin-318': 'monin/gingembre-70',
  'p-monin-331': 'monin/pomme-verte-70',
  'p-monin-308': 'monin/pop-corn-70',
  'p-monin-321': 'monin/noisettes-grillees-70',
  'p-monin-307': 'monin/caramel-sale-70',
  'p-monin-300': 'monin/speculos-70',
  'p-fk-monin-toffee-nut-70cl': 'monin/toffee-nut-70',
  'p-monin-173': 'monin/chocolat-blanc-70',
  'p-fk-monin-mure-70cl': 'monin/mure-70',
  'p-monin-336': 'monin/the-framboise-70',
  'p-monin-452': 'monin/cerise-70',
  'p-monin-166': 'monin/bubble-gum-70',
  'p-monin-335': 'monin/the-citron-70',
  'p-monin-324': 'monin/framboise-70',
  'p-monin-464': 'monin/mangue-70',
  'p-monin-479': 'monin/guimauve-70',
  'p-monin-480': 'monin/matcha-70',
  'p-fk-monin-the-citron-1l': 'monin/the-citron-1l',
  'p-fk-monin-the-peche-1l': 'monin/the-peche-1l',
  'p-monin-326': 'monin/fraise-1l',
  'p-monin-333': 'monin/vanille-1l',
  'p-fk-monin-framboise-1l': 'monin/framboise-1l',
  'p-fk-monin-fruit-de-la-passion-1l': 'monin/passion-1l',
  'p-fk-monin-caramel-1l': 'monin/caramel-1l',
  'p-monin-162': 'monin/sucre-canne-1l',
  'p-monin-325': 'monin/mojito-1l',
  'p-monin-327': 'monin/chocolat-1l',
  'p-monin-482': 'monin/espresso-martini-1l',
  'p-monin-416': 'monin/curacao-25',
  'p-fk-monin-vanille-25cl': 'monin/vanille-25',
  'p-monin-422': 'monin/mojito-25',
  'p-monin-419': 'monin/fraise-25',
  'p-fk-monin-fruit-de-la-passion-25cl': 'monin/passion-25',
  'p-fk-monin-noix-de-coco-25cl': 'monin/coco-25',
  'p-monin-421': 'monin/grenadine-25',
  'p-monin-425': 'monin/noisette-25',
  'p-fk-monin-chocolat-cookie-25cl': 'monin/chocolat-cookie-25',
  'p-fk-monin-caramel-25cl': 'monin/caramel-25',
  'p-monin-447': 'monin/coffret-25',
  // MONIN purées, sauces, frappés, accessories
  'p-monin-275': 'monin/puree-coco',
  'p-monin-268': 'monin/puree-fraise',
  'p-fk-monin-puree-peche-1l': 'monin/puree-peche',
  'p-fk-monin-puree-framboise-1l': 'monin/puree-framboise',
  'p-monin-272': 'monin/puree-fruits-rouges',
  'p-monin-271': 'monin/puree-pomme-verte',
  'p-monin-276': 'monin/puree-myrtilles',
  'p-fk-monin-puree-mangue-1l': 'monin/puree-mangue',
  'p-fk-monin-puree-passion-1l': 'monin/puree-passion',
  'p-fk-monin-puree-banane-1l': 'monin/puree-banane',
  'p-monin-266': 'monin/puree-kiwi',
  'p-fk-monin-puree-lychee-1l': 'monin/puree-lychee',
  'p-fk-monin-puree-ananas-1l': 'monin/puree-ananas',
  'p-monin-459': 'monin/puree-cassis',
  'p-monin-175': 'monin/sauce-caramel',
  'p-monin-177': 'monin/sauce-chocolat-noir',
  'p-fk-monin-sauce-chocolat-blanc-1-89l': 'monin/sauce-chocolat-blanc',
  'p-monin-282': 'monin/frappe-cafe-boite',
  'p-fk-monin-frappe-cafe-sac-2kg': 'monin/frappe-cafe-sac',
  'p-fk-monin-frappe-neutre-1-36kg': 'monin/frappe-neutre-boite',
  'p-fk-monin-frappe-neutre-sac-2kg': 'monin/frappe-neutre-sac',
  'p-monin-280': 'monin/frappe-vanille-boite',
  'p-fk-monin-frappe-vanille-sac-2kg': 'monin/frappe-vanille-sac',
  'p-fk-monin-frappe-chocolat-1-36kg': 'monin/frappe-chocolat-boite',
  'p-monin-287': 'monin/pompe-15',
  'p-monin-286': 'monin/pompe-10-1l',
  'p-monin-285': 'monin/pompe-10-70',
  'p-monin-289': 'monin/pilon',
  'p-monin-293': 'monin/tapis',
  'p-monin-292': 'monin/shaker',
  'p-monin-453': 'monin/doseur-25-50',
  'p-monin-288': 'monin/doseur-30-60',
  'p-monin-294': 'monin/dispenser',
  'p-monin-290': 'monin/presentoir',
  'p-monin-363': 'monin/cuillere',
  'p-fk-monin-bac-glacons-6l': 'monin/bac-glacons',

  // Pâtisserie
  'p-vinto-104': 'patisserie/poche-55',
  'p-vinto-103': 'patisserie/poche-40',
  'p-fk-papier-cuisson-multi-passages-40x60': 'patisserie/cuisson-multi',
  'p-vinto-108': 'patisserie/cuisson',
  'p-vinto-105': 'patisserie/ruban-30',
  'p-fk-ruban-patissier-40mm': 'patisserie/ruban-40',
  'p-vinto-107': 'patisserie/ruban-50',
  'p-vinto-109': 'patisserie/dentelle-114',
  'p-vinto-110': 'patisserie/dentelle-140',
  'p-vinto-111': 'patisserie/dentelle-165',
  'p-vinto-112': 'patisserie/dentelle-190',
  'p-vinto-113': 'patisserie/dentelle-216',
  'p-vinto-114': 'patisserie/dentelle-240',
  'p-vinto-115': 'patisserie/dentelle-265',
  'p-vinto-116': 'patisserie/dentelle-285',
  'p-vinto-117': 'patisserie/dentelle-305',
  'p-vinto-118': 'patisserie/dentelle-320',
  'p-vinto-119': 'patisserie/dentelle-360',
  'p-vinto-120': 'patisserie/dentelle-26x36',
  'p-vinto-121': 'patisserie/dentelle-30x39',
  'p-vinto-122': 'patisserie/dentelle-36x44',
  'p-vinto-123': 'patisserie/dentelle-40x50',
  'p-vinto-124': 'patisserie/caissette-5',
  'p-vinto-125': 'patisserie/caissette-6',
  'p-vinto-126': 'patisserie/caissette-7',

  // Hygiène
  'p-vinto-145': 'hygiene/toque-legere',
  'p-vinto-152': 'hygiene/toque-master-chef',
  'p-vinto-150': 'hygiene/toque-cambi',
  'p-vinto-151': 'hygiene/calot',
  'p-vinto-349': 'hygiene/calot',
  'p-vinto-148': 'hygiene/coiffe-charlotte',
  'p-vinto-351-69': 'hygiene/gants-vinyle',
  'p-vinto-353-67': 'hygiene/gants-latex',
  'p-vinto-355-64': 'hygiene/gants-nitrile',
  'p-vinto-356-72': 'hygiene/gants-pe',
  'p-fk-gant-de-menage': 'hygiene/gant-menage',
  'p-fk-bonnet-de-douche': 'hygiene/bonnet-douche',
  'p-vinto-146': 'hygiene/coiffe-bouffant',
  'p-vinto-144': 'hygiene/masque',
  'p-fk-tablier-polyethylene': 'hygiene/tablier-pe',
  'p-vinto-153': 'hygiene/casquette',
  'p-fk-sur-chaussure-pvc': 'hygiene/sur-chaussure-pvc',
  'p-vinto-158': 'hygiene/sur-chaussure-non-tissee',
  'p-vinto-154': 'hygiene/manchette',
  'p-fk-combinaison': 'hygiene/combinaison',
  'p-vinto-156': 'hygiene/blouse-non-tissee',

  // Films et aluminium
  'p-fk-film-avec-boite-30cm-300m': 'film/avec-30x300',
  'p-fk-film-avec-boite-45cm-300m': 'film/avec-45x300',
  'p-vinto-93': 'film/sans-30x50',
  'p-vinto-94': 'film/sans-30x100',
  'p-fk-film-sans-boite-30cm-300m': 'film/sans-30x300',
  'p-fk-film-sans-boite-45cm-300m': 'film/sans-45x300',
  'p-vinto-95': 'film/avec-25x1500',
  'p-fk-film-avec-boite-30cm-1500m': 'film/avec-30x1500',
  'p-fk-film-avec-boite-45cm-1500m': 'film/avec-45x1500',
  'p-vinto-98': 'alu/30x100',
  'p-fk-aluminium-45cm-100m': 'alu/45x100',
  'p-fk-aluminium-45cm-150m': 'alu/45x150',

  // Gobelets (the site sells cup + lid bundles)
  'p-vinto-48': ['gobelets/pet-12', 'gobelets/couvercle-pet-sans-trou'],
  'p-vinto-51': ['gobelets/pet-16', 'gobelets/couvercle-pet-sans-trou'],
  'p-vinto-46': ['gobelets/pet-9', 'gobelets/couvercle-pet-sans-trou'],
  'p-vinto-54': 'gobelets/papier-125',
  'p-vinto-79': ['gobelets/bol-eps-8', 'gobelets/couvercle-pp-8'],
  'p-vinto-179': ['gobelets/eps-7', 'gobelets/couvercle-ps-7'],
  'p-vinto-52': ['gobelets/eps-12', 'gobelets/couvercle-ps-12'],
  'p-vinto-53': ['gobelets/eps-16', 'gobelets/couvercle-ps-16'],

  // Couverts
  'p-vinto-130': 'couverts/couteau-plastique',
  'p-vinto-129': 'couverts/fourchette-plastique',
  'p-vinto-128': 'couverts/cuillere-plastique',
  'p-vinto-127': 'couverts/petite-cuillere-plastique',
  'p-vinto-131': 'couverts/fourchette-bois',
  'p-vinto-132': 'couverts/couteau-bois',
  'p-vinto-133': 'couverts/cuillere-bois',
  'p-vinto-134': 'couverts/cuillere-dessert-bois',

  // Emballages alimentaires
  'p-vinto-76': 'emballages/soupe-kraft-500',
  'p-vinto-77': 'emballages/soupe-kraft-1000',
  'p-vinto-78': 'emballages/soupe-blanc-500',
  'p-vinto-373': 'emballages/soupe-blanc-1100',
  'p-vinto-82': 'emballages/salade-kraft-500',
  'p-vinto-83': 'emballages/salade-kraft-1100',
  'p-vinto-84': 'emballages/salade-blanc-500',
  'p-vinto-372': 'emballages/salade-blanc-1100',
  'p-vinto-91': 'emballages/fritures-220',
  'p-vinto-92': 'emballages/fritures-400',
  'p-vinto-370': 'emballages/poche-frites-pm',
  'p-vinto-371': 'emballages/poche-frites-mm',
  'p-vinto-90': 'emballages/pochette-frites',
  'p-vinto-89': 'emballages/pochette-frites-sauces',
  'p-vinto-88': 'emballages/pot-pate',
  'p-vinto-87': 'emballages/hamburger-moyenne',
  'p-vinto-369': 'emballages/hamburger-gm',
  'p-vinto-85': 'emballages/micro-2',
  'p-vinto-86': 'emballages/micro-3',
  'p-vinto-483': 'emballages/sushi-170',
  'p-vinto-484': 'emballages/sushi-193',
  'p-vinto-485': 'emballages/sushi-224',
  'p-vinto-101': 'emballages/pot-sauce-30',
  'p-vinto-102': 'emballages/pot-sauce-60',

  // Pailles
  'p-fk-paille-papier-230x8': 'pailles/papier',
  'p-vinto-361': 'pailles/cuillere',
  'p-fk-paille-noire-petit-modele-130x8': 'pailles/noire-petit',
  'p-fk-paille-noire-smoothie-210x10': 'pailles/noire-smoothie',
  'p-vinto-241': 'pailles/bubble',
  'p-vinto-242': 'pailles/noire-enveloppee',
  'p-vinto-240': 'pailles/noire',
  'p-vinto-237': 'pailles/simple',
  'p-vinto-238': 'pailles/flexible',

  // Polycarbonate (colours from the Vinto supplier references)
  'p-fk-verre-polycarbonate-250ml-transparent': 'poly/250-t',
  'p-vinto-59': 'poly/250-b',
  'p-vinto-57': 'poly/250-v',
  'p-vinto-58': 'poly/250-m',
  'p-vinto-467': 'poly/250-j',
  'p-vinto-56': 'poly/250-r',
  'p-fk-verre-a-pied-polycarbonate-295ml': 'poly/295',
  'p-vinto-62': 'poly/300-j',
  'p-vinto-468': 'poly/300-m',
  'p-vinto-64': 'poly/300-t',
  'p-vinto-60': 'poly/300-r',
  'p-vinto-65': 'poly/300-v',
  'p-vinto-72': 'poly/biere-400',
  'p-vinto-70': 'poly/400-j',
  'p-vinto-74': 'poly/chope-500',

  // Asiatiques and brochettes
  'p-fk-baguette-chinoise-enveloppee-21cm': 'asiatique/baguette',
  'p-vinto-232': 'asiatique/brochette-20',
  'p-vinto-233': 'asiatique/brochette-25',

  // Verrines
  'p-vinto-187': 'verrines/assida',
  'p-vinto-391': 'verrines/coupe-base-70',
  'p-vinto-186': 'verrines/rond-carree-60',
  'p-vinto-379': 'verrines/felicita-50',
  'p-vinto-346': 'verrines/tube-70',
  'p-vinto-182': 'verrines/cylindre-50',
  'p-vinto-189': 'verrines/cylindre-80',
  'p-vinto-185': 'verrines/cube-50',
  'p-vinto-188': 'verrines/cube-100',
  'p-vinto-190': ['verrines/cube-150', 'verrines/couvercle-cube-150'],
  'p-vinto-348': 'verrines/goutte-11',
  'p-vinto-183': 'verrines/goutte-11',
  'p-vinto-194': 'verrines/cuillere-chinoise',
  'p-vinto-195': 'verrines/fourchette',
  'p-vinto-196': 'verrines/cuillere',
  'p-vinto-200': 'verrines/bateau-8x13',
  'p-vinto-199': 'verrines/bateau-7x12',
  'p-fk-bateau-ovale-5-7x9': 'verrines/bateau-5x9',
  'p-vinto-201': 'verrines/cornet-15',
  'p-vinto-198': 'verrines/cornet-13',

  // Piques
  'p-vinto-204': 'piques/etoile-rose-vert',
  'p-vinto-222': 'piques/bois-vert-9',
  'p-vinto-224': 'piques/bois-vert-12',
  'p-vinto-450': 'piques/bois-vert-15',
  'p-vinto-227': 'piques/bamboo-doigt',
  'p-fk-pique-beige-3x12': 'piques/beige',
  'p-vinto-208': 'piques/rouge-noir',
  'p-vinto-206': 'piques/vert-noir',
  'p-vinto-214': 'piques/boule-bleue',
  'p-vinto-215': 'piques/boule-rouge',
  'p-fk-pique-boule-rose-3x12': 'piques/boule-rose',
  'p-vinto-212': 'piques/boule-orange',
  'p-vinto-213': 'piques/boule-jaune',
  'p-vinto-216': 'piques/boule-verte',
  'p-vinto-225': 'piques/ciseaux',
  'p-vinto-220': 'piques/2-boules-jaune',
  'p-vinto-217': 'piques/2-boules-rouge',
  'p-vinto-205': 'piques/etoile-rouge-vert',
  'p-vinto-202': 'piques/bamboo-9',
  'p-vinto-219': 'piques/perle-or',
  'p-vinto-218': 'piques/perle-satin',
  'p-vinto-231': 'piques/plume',
  'p-vinto-226': 'piques/boucle-13',
  'p-fk-pique-scelle-9cm': 'piques/scelle-9',
  'p-vinto-210': 'piques/p-13',
  'p-fk-pique-trident-9cm': 'piques/trident-9',
  'p-fk-pique-cloche': 'piques/cloche',
  'p-vinto-223': 'piques/sapin',
  'p-fk-pique-coquillage': 'piques/coquillage',
  'p-vinto-203': 'piques/petites-boules',
  'p-vinto-235': 'piques/cure-dents-boite',
  'p-vinto-234': 'piques/cure-dents-enveloppes',
};

/**
 * Catalogue products with no supplier line, and why. They keep their current
 * price; each is listed in the report.
 */
export const UNPRICED_BY_SUPPLIER: Readonly<Record<string, string>> = {
  'p-vinto-228':
    '« Pique en bois vert 18cm » : la liste Piques donne « Pics en bois 18cm » (sans « vert ») — identité non établie',
  'p-vinto-445':
    '« Blouses visiteurs jetables en polyéthylène » : la liste hygiène donne « Tablier visiteur en Polyéthylène » — identité non établie',
};

// ---------------------------------------------------------------------------
// Sale terms

export type SupplierPricingStatus = 'PRICED' | 'UNAVAILABLE' | 'SOURCE_INCOMPLETE';

export interface SupplierPricing {
  readonly status: SupplierPricingStatus;
  readonly lines: readonly SupplierLineKey[];
  readonly saleMode: 'UNIT' | 'PACK_ONLY';
  /** Price of one piece in millimes (PACK_ONLY), or null. */
  readonly unitMillimes: number | null;
  /** Pieces per sale lot; the PDF colisage unless the site already sells another lot. */
  readonly packQuantity: number | null;
  /** Price of one sale unit (a pack, or the single article), in millimes; null when unknown. */
  readonly priceMillimes: number | null;
  readonly unit: UnitCode;
  /** Supplier carton, when it differs from the sale lot. */
  readonly supplierColisage: number;
  readonly vat: number | null;
  readonly reference: string | null;
  readonly note: string | null;
}

const millimes = (price: string): number => {
  const [whole, fraction = ''] = price.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
};

/**
 * The sale terms a supplier line gives a catalogue product.
 *
 * @param websiteLot the lot the site already sells ("LES 250 PIÈCES"), which
 *   is kept; without one the product is sold by the PDF colisage.
 */
export function supplierPricing(
  productId: string,
  websiteLot: number | undefined,
): SupplierPricing | null {
  const mapped = PRODUCT_SUPPLIER_LINES[productId];
  if (!mapped) return null;
  const keys: readonly SupplierLineKey[] = typeof mapped === 'string' ? [mapped] : mapped;
  const lines = keys.map((key) => SUPPLIER_LINES[key]);
  const main = lines[0]!;
  const lot = websiteLot && websiteLot > 0 ? websiteLot : main.colisage;
  const base = {
    lines: keys,
    unit: main.unit,
    supplierColisage: main.colisage,
    vat: main.vat ?? null,
    reference: main.reference ?? null,
  };

  if (lines.some((entry) => entry.price === null)) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      saleMode: 'UNIT',
      unitMillimes: null,
      packQuantity: websiteLot ?? null,
      priceMillimes: null,
      note: 'Rupture provisoire : la liste ne publie pas de prix',
    };
  }

  // Price of one piece: summed for a bundle, divided back from a lot price only
  // when the division is exact to the millime.
  let piece = 0;
  for (const entry of lines) {
    const amount = millimes(entry.price!);
    if (entry.basis === 'piece') {
      piece += amount;
    } else if (amount % entry.colisage === 0) {
      piece += amount / entry.colisage;
    } else if (lot === entry.colisage && lines.length === 1) {
      // Sold as exactly the priced lot: its price is the price, undivided.
      return {
        ...base,
        status: 'PRICED',
        saleMode: 'UNIT',
        unitMillimes: null,
        packQuantity: lot,
        priceMillimes: amount,
        note: `Prix du lot de ${entry.colisage} (division non exacte au millime)`,
      };
    } else {
      return {
        ...base,
        status: 'SOURCE_INCOMPLETE',
        saleMode: 'UNIT',
        unitMillimes: null,
        packQuantity: websiteLot ?? null,
        priceMillimes: null,
        note: `Prix PDF pour ${entry.colisage} pièces ; le site vend par ${lot} et ${entry.price} / ${entry.colisage} n'est pas exact au millime`,
      };
    }
  }

  if (lot === 1) {
    return {
      ...base,
      status: 'PRICED',
      saleMode: 'UNIT',
      unitMillimes: null,
      packQuantity: null,
      priceMillimes: piece,
      note: lines.length > 1 ? 'Lot = somme des lignes PDF' : null,
    };
  }
  return {
    ...base,
    status: 'PRICED',
    saleMode: 'PACK_ONLY',
    unitMillimes: piece,
    packQuantity: lot,
    priceMillimes: piece * lot,
    note:
      lines.length > 1
        ? `Prix unitaire = ${keys.map((key) => SUPPLIER_LINES[key].price).join(' + ')} (article vendu avec son couvercle)`
        : null,
  };
}

/** The lot the site sold before the supplier reconciliation, from the Vinto feed. */
export function websiteLotOf(feedProduct: Product | undefined): number | undefined {
  const quantity = feedProduct?.formats[0]?.packQuantity;
  return quantity && quantity > 0 ? quantity : undefined;
}
