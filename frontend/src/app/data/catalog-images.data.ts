// Photographs the client supplied for products that had none, matched by file
// name (imformations_about_products_provided_by_the_client/). Each match is
// declared here with the reason it is certain; scripts/prepare-catalogue-images.mjs
// validates the source files, produces /img/products/catalogue/<file>.v2.webp
// with the same pipeline as every other product photograph, and writes
// product-image-reconciliation.json.
//
// A match is kept only when the file name identifies the product and its
// format. Where the name leaves the format out, the product must be the only
// format of that flavour in the catalogue, and the photograph shows it. A file
// whose picture contradicts its name is never used.

export interface CatalogImageMatch {
  /** Source file(s), relative to the client folder. Several = one gallery, first is the main photo. */
  readonly sources: readonly string[];
  /**
   * Photographs the owner already uploaded to ImageKit through the back office,
   * used as they are (no local file). They take precedence over `sources`.
   */
  readonly hosted?: readonly {
    readonly src: string;
    readonly width: number | null;
    readonly height: number | null;
  }[];
  /** Destination base name under /img/products/catalogue/ (".v2.webp" is appended). */
  readonly file: string;
  readonly matchType: 'exact' | 'name-and-format' | 'unique-in-catalogue' | 'owner-upload';
  readonly reason: string;
}

const S1 = 'visuelsproduits/sirop 1/sirop 1';
const S2 = 'visuelsproduits/sirop 2/sirop 2';
const S3 = 'visuelsproduits/sirop 3/sirop 3';
const PUREE = 'visuelsproduits (1)/puree/puree';
const FRAPPE = 'visuelsproduits (1)/frappee/frappee';
const PIQUE = 'visuelsproduits/pique/pique';
const PAILLES = 'visuelsproduits/PAILLES/PAILLES';

/**
 * A photograph the client named exactly after the product, format included
 * (image_catering/). Some file names reached disk with their accents
 * double-encoded ("Frapp├⌐" for "Frappé"); they are kept verbatim here, since
 * they are the files' real names, and compared after repair.
 */
const exact = (source: string, file: string): CatalogImageMatch => ({
  sources: [`image_catering/${source}`],
  file,
  matchType: 'exact',
  reason: 'Fichier nommé exactement comme le produit, format compris',
});

/**
 * A photograph the owner uploaded to this product in the back office (read
 * from Neon, 2026-09-29). It is already on ImageKit and is kept as is.
 */
const owner = (src: string, width: number | null, height: number | null): CatalogImageMatch => ({
  sources: [],
  hosted: [{ src, width, height }],
  file: '',
  matchType: 'owner-upload',
  reason: 'Photo téléversée par le propriétaire dans l’administration (ImageKit)',
});

const puree = (file: string, source: string, fruit: string): CatalogImageMatch => ({
  sources: [`${PUREE}/${source}`],
  file,
  matchType: 'unique-in-catalogue',
  reason: `Seule purée ${fruit} du catalogue (1 L) ; flacon « Le Fruit de MONIN »`,
});

export const CATALOG_IMAGES: Readonly<Record<string, CatalogImageMatch>> = {
  'p-fk-monin-pasteque-70cl': {
    sources: [`${S1}/70CL SIROP PASTEQUE MONIN.png`],
    file: 'monin-sirop-pasteque-70cl',
    matchType: 'name-and-format',
    reason: 'Nom et format (70 cl) dans le fichier',
  },
  'p-fk-monin-vanille-25cl': {
    sources: [`${S3}/Vanilla-25cl-HD.png`],
    file: 'monin-sirop-vanille-25cl',
    matchType: 'name-and-format',
    reason: 'Vanille (Vanilla) et format 25 cl dans le fichier',
  },
  'p-fk-monin-caramel-25cl': {
    sources: [`${S1}/Caramel-25cl-HD.png`],
    file: 'monin-sirop-caramel-25cl',
    matchType: 'name-and-format',
    reason: 'Caramel et format 25 cl dans le fichier (le fichier 70 cl n’est pas utilisé)',
  },
  'p-fk-monin-citron-vert-70cl': {
    sources: [`${S3}/SIROP CITRON VERT.png`],
    file: 'monin-sirop-citron-vert-70cl',
    matchType: 'unique-in-catalogue',
    reason: 'Seul sirop citron vert du catalogue (70 cl) ; bouteille 70 cl « Lime »',
  },
  'p-fk-monin-melon-70cl': {
    sources: [`${S3}/SIROP MELON.png`],
    file: 'monin-sirop-melon-70cl',
    matchType: 'unique-in-catalogue',
    reason: 'Seul sirop melon du catalogue (70 cl) ; bouteille 70 cl',
  },
  'p-monin-307': {
    sources: [`${S3}/SIROP CARAMEL SALE.png`],
    file: 'monin-sirop-caramel-sale-70cl',
    matchType: 'unique-in-catalogue',
    reason: 'Seul sirop caramel salé du catalogue (70 cl) ; bouteille 70 cl « Caramel Salé »',
  },
  'p-fk-monin-mure-70cl': {
    sources: [`${S2}/Mure-FR-HD.png`],
    file: 'monin-sirop-mure-70cl',
    matchType: 'unique-in-catalogue',
    reason: 'Seul sirop mûre du catalogue (70 cl) ; bouteille 70 cl « Mûre »',
  },
  'p-monin-275': puree('monin-puree-noix-de-coco-1l', 'PUREE NOIX DE COCO .png', 'noix de coco'),
  'p-monin-268': puree(
    'monin-puree-fraise-1l',
    'PUREE DE FRAISE 1.32 KG.png',
    'fraise (1,32 kg = poids du flacon de 1 L)',
  ),
  'p-fk-monin-puree-peche-1l': puree('monin-puree-peche-1l', 'PUREE DE PECHE .png', 'pêche'),
  'p-fk-monin-puree-framboise-1l': puree(
    'monin-puree-framboise-1l',
    'PUREE FRAMBOISE MONIN.png',
    'framboise',
  ),
  'p-monin-276': puree('monin-puree-myrtilles-1l', 'PUREE MYRTILLES .png', 'myrtilles'),
  'p-fk-monin-puree-mangue-1l': puree('monin-puree-mangue-1l', 'PUREE MANGUE MONIN.png', 'mangue'),
  'p-fk-monin-puree-passion-1l': puree(
    'monin-puree-passion-1l',
    'PUREE FRUIT DE PASSION .png',
    'passion',
  ),
  'p-fk-monin-puree-banane-1l': puree('monin-puree-banane-1l', 'PUREE DE BANANE .png', 'banane'),
  'p-fk-monin-puree-lychee-1l': puree('monin-puree-lychee-1l', 'PUREE LYCHEE MONIN .png', 'lychee'),
  'p-fk-monin-puree-ananas-1l': {
    sources: [`${PUREE}/1L PUREE ANANAS.png`],
    file: 'monin-puree-ananas-1l',
    matchType: 'name-and-format',
    reason: 'Ananas et format 1 L dans le fichier',
  },
  'p-fk-monin-frappe-neutre-1-36kg': {
    sources: [`${FRAPPE}/BOITE FRAPPE NEUTRE 1.36KG.png`],
    file: 'monin-frappe-neutre-1-36kg',
    matchType: 'name-and-format',
    reason: 'Neutre, boîte 1,36 kg dans le fichier (le sac 2 kg n’a pas de photo)',
  },
  'p-fk-monin-frappe-chocolat-1-36kg': {
    sources: [`${FRAPPE}/1.36KG FRAPPE CHOCOLAT.png`],
    file: 'monin-frappe-chocolat-1-36kg',
    matchType: 'name-and-format',
    reason: 'Chocolat et format 1,36 kg dans le fichier',
  },
  'p-fk-baguette-chinoise-enveloppee-21cm': {
    sources: [`${PIQUE}/BAGUETTE CHINOISE 210100PCS.png`],
    file: 'baguette-chinoise-enveloppee-21cm',
    matchType: 'name-and-format',
    reason: 'Baguette chinoise, 210 mm (21 cm), 100 pièces dans le fichier',
  },
  'p-fk-champignons-emporium-425g': exact(
    'Champignons en tranches Emporium 425g.png',
    'champignons-en-tranches-emporium-425g',
  ),
  'p-fk-champignons-emporium-850g': exact(
    'Champignons en tranches Emporium 850g.png',
    'champignons-en-tranches-emporium-850g',
  ),
  'p-fk-mais-doux-emporium-425g': exact('Maïs doux Emporium 425g.png', 'mais-doux-emporium-425g'),
  'p-fk-mais-doux-emporium-3100ml': exact(
    'Maïs doux Emporium 3100ml.png',
    'mais-doux-emporium-3100ml',
  ),
  'p-fk-haricots-rouges-emporium-400g': exact(
    'Haricots rouges Emporium 400g.png',
    'haricots-rouges-emporium-400g',
  ),
  'p-fk-moutarde-dijon-dijona-850g': exact(
    'Moutarde forte de Dijon Dijona 850gr.png',
    'moutarde-forte-de-dijon-dijona-850g',
  ),
  'p-fk-monin-orange-70cl': exact('Sirop orange MONIN 70cl.png', 'monin-sirop-orange-70cl'),
  'p-fk-monin-brownies-70cl': exact('Sirop brownies MONIN 70cl.png', 'monin-sirop-brownies-70cl'),
  'p-fk-monin-barbe-a-papa-70cl': exact(
    'Sirop barbe à papa MONIN 70cl.png',
    'monin-sirop-barbe-a-papa-70cl',
  ),
  'p-fk-monin-toffee-nut-70cl': exact(
    'Sirop toffee nut MONIN 70cl.png',
    'monin-sirop-toffee-nut-70cl',
  ),
  'p-fk-monin-the-citron-1l': exact('Sirop th├⌐ citron MONIN 1L.png', 'monin-sirop-the-citron-1l'),
  'p-fk-monin-the-peche-1l': exact('Sirop th├⌐ p├¬che MONIN 1L.png', 'monin-sirop-the-peche-1l'),
  'p-fk-monin-framboise-1l': exact('Sirop framboise MONIN 1L.png', 'monin-sirop-framboise-1l'),
  'p-fk-monin-fruit-de-la-passion-1l': exact(
    'Sirop fruit de la passion MONIN 1L.png',
    'monin-sirop-fruit-de-la-passion-1l',
  ),
  'p-fk-monin-caramel-1l': exact('Sirop caramel MONIN 1L.png', 'monin-sirop-caramel-1l'),
  'p-fk-monin-fruit-de-la-passion-25cl': exact(
    'Sirop fruit de la passion MONIN 25cl.png',
    'monin-sirop-fruit-de-la-passion-25cl',
  ),
  'p-fk-monin-noix-de-coco-25cl': exact(
    'Sirop saveur noix de coco MONIN 25cl.png',
    'monin-sirop-noix-de-coco-25cl',
  ),
  'p-fk-monin-chocolat-cookie-25cl': exact(
    'Sirop saveur chocolat cookie MONIN 25cl.png',
    'monin-sirop-chocolat-cookie-25cl',
  ),
  'p-fk-monin-sauce-chocolat-blanc-1-89l': exact(
    'Sauce chocolat blanc MONIN 1,89L.png',
    'monin-sauce-chocolat-blanc-1-89l',
  ),
  'p-fk-monin-frappe-cafe-sac-2kg': exact(
    'Frapp├⌐ caf├⌐ MONIN sac 2kg.png',
    'monin-frappe-cafe-sac-2kg',
  ),
  'p-fk-monin-frappe-neutre-sac-2kg': exact(
    'Frapp├⌐ neutre MONIN sac 2kg.png',
    'monin-frappe-neutre-sac-2kg',
  ),
  'p-fk-monin-frappe-vanille-sac-2kg': exact(
    'Frapp├⌐ vanille MONIN sac 2kg.png',
    'monin-frappe-vanille-sac-2kg',
  ),
  'p-fk-monin-bac-glacons-6l': exact(
    'Bac de stockage ├á gla├ºons MONIN 6L.png',
    'monin-bac-de-stockage-a-glacons-6l',
  ),
  // Photographs the owner uploaded in the back office.
  'p-fk-aluminium-45cm-100m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_45_46-PM_-BPxDftdC.png',
    1536,
    1024,
  ),
  'p-fk-aluminium-45cm-150m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_45_46-PM_QDcrs05pV.png',
    1536,
    1024,
  ),
  'p-fk-bateau-ovale-5-7x9': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/bateau-ovale-7-12_svGKBUBDI.jpg',
    800,
    800,
  ),
  'p-fk-bonnet-de-douche': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_12-PM-5_Cb2atILB0.png',
    1254,
    1254,
  ),
  'p-fk-combinaison': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_07-PM-1_Tnn3FEzZ2.png',
    1254,
    1254,
  ),
  'p-fk-film-avec-boite-30cm-1500m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_41-PM-3_IQsmfVlpK.png',
    1254,
    1254,
  ),
  'p-fk-film-avec-boite-30cm-300m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_38-PM-1_Zsdc2dgG8.png',
    1254,
    1254,
  ),
  'p-fk-film-avec-boite-45cm-1500m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_41-PM-3_KfS1BuP0D.png',
    1254,
    1254,
  ),
  'p-fk-film-avec-boite-45cm-300m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_38-PM-1_7m4IVmkhl.png',
    1254,
    1254,
  ),
  'p-fk-film-sans-boite-30cm-300m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_40-PM-2_LJ0trzWRG.png',
    1254,
    1254,
  ),
  'p-fk-film-sans-boite-45cm-300m': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-09_31_40-PM-2_gbP_XiAZr.png',
    1254,
    1254,
  ),
  'p-fk-gant-de-menage': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_10-PM-4_S0IOM7QnD.png',
    1448,
    1086,
  ),
  'p-fk-monin-cookies-70cl': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/SIROP-CHOCOLAT-COOKIES_mDYSNk_tx.png',
    1000,
    1000,
  ),
  'p-fk-paille-noire-petit-modele-130x8': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/PAILLE-NOIR-ENVELOPPEE_i1OBhj_rr.jpg',
    1200,
    1200,
  ),
  'p-fk-paille-noire-smoothie-210x10': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/PAILLE-NOIR-ENVELOPPEE_3BHS_NcaI.jpg',
    1200,
    1200,
  ),
  'p-fk-papier-cuisson-multi-passages-40x60': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/papier-cuisson_pZFE5iSgc.jpg',
    650,
    400,
  ),
  'p-fk-pique-beige-3x12': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_22_20-PM_pI1HuH2wa.png',
    1448,
    1086,
  ),
  'p-fk-pique-boule-rose-3x12': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_05_53-PM_U311qXoqX.png',
    1448,
    1086,
  ),
  'p-fk-pique-cloche': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_15_12-PM-3_gonUM-twn.png',
    1448,
    1086,
  ),
  'p-fk-pique-coquillage': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_15_10-PM-1_SHwSCENVQ.png',
    1448,
    1086,
  ),
  'p-fk-pique-scelle-9cm': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_15_11-PM-2_DoqG7Y4wB.png',
    1448,
    1086,
  ),
  'p-fk-pique-trident-9cm': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-10_19_21-PM_rvKMaSe9_.png',
    2035,
    773,
  ),
  'p-fk-ruban-patissier-40mm': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ruban-patissier-en-pvc-hauteur-30mm_uMjdV9iHE.jpg',
    800,
    800,
  ),
  'p-fk-sur-chaussure-pvc': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_08-PM-2_VySDEi6iu.png',
    1254,
    1254,
  ),
  'p-fk-tablier-polyethylene': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_09-PM-3_67Iru3H9S.png',
    1122,
    1402,
  ),
  'p-fk-verre-a-pied-polycarbonate-295ml': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-06_21_26-PM_ufN4VBNbE.png',
    1254,
    1254,
  ),
  'p-fk-verre-polycarbonate-250ml-transparent': owner(
    'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-06_11_55-PM_fWM6GRhmV.png',
    1254,
    1254,
  ),
  // The paper straw is one article in several colours (the price list names
  // them); both colour photographs are its gallery, neither chosen at random.
  'p-fk-paille-papier-230x8': {
    sources: [
      `${PAILLES}/paille papier rouge et blanc 2.jpg`,
      `${PAILLES}/paille en papier vert et blanc.jpg`,
    ],
    file: 'paille-en-papier-230mm-x-8mm',
    matchType: 'unique-in-catalogue',
    reason:
      'Seule paille en papier du catalogue ; rayée rouge et rayée vert = deux couleurs listées',
  },
};

/**
 * Candidates seen and deliberately not used, so the report can say why the
 * product still has no photograph.
 */
export const CATALOG_IMAGE_REJECTIONS: Readonly<Record<string, string>> = {};
