// =============================================================================
// CATEGORIES — the catalogue's first-level commercial universes.
//
// Category names come directly from the legacy site's own navigation
// (Agro-Alimentaire / Emballage / Hygiène). Subcategories are derived from the
// 150 master-gallery catalogue items, not invented.
// =============================================================================

import { Category } from '../shared/models/catalog.model';

export const CATEGORIES: readonly Category[] = [
  {
    id: 'food',
    slug: 'food',
    name: { en: 'Food & Beverage', fr: 'Agro-alimentaire' },
    shortName: { en: 'Food', fr: 'Agro-alimentaire' },
    description: {
      en: 'Sauces, dressings, condiments, syrups, canned goods and coffee for professional kitchens and retail.',
      fr: 'Sauces, vinaigrettes, condiments, sirops, conserves et cafés pour les cuisines professionnelles et la distribution.',
    },
    longDescription: {
      en: 'Our food and beverage division supplies the ingredients professional kitchens work with every day — from bar syrups and frappé bases to mayonnaises, mustards, dressings and canned fruit in institutional formats. Suppliers are selected against European and international standards.',
      fr: 'Notre division agro-alimentaire fournit les ingrédients avec lesquels travaillent quotidiennement les cuisines professionnelles : sirops de bar et bases frappé, mayonnaises, moutardes, vinaigrettes et conserves de fruits en formats collectivité. Nos fournisseurs sont sélectionnés selon les normes européennes et internationales.',
    },
    image: '/img/categories/food.jpg',
    icon: 'bottle',
    accent: 'var(--c-cat-food)',
    subcategories: [
      {
        id: 'syrups',
        slug: 'syrups',
        categoryId: 'food',
        name: { en: 'Syrups & beverage bases', fr: 'Sirops et bases boissons' },
      },
      {
        id: 'sauces-dressings',
        slug: 'sauces-dressings',
        categoryId: 'food',
        name: { en: 'Sauces & dressings', fr: 'Sauces et vinaigrettes' },
      },
      {
        id: 'condiments',
        slug: 'condiments',
        categoryId: 'food',
        name: { en: 'Condiments', fr: 'Condiments' },
      },
      {
        id: 'canned',
        slug: 'canned',
        categoryId: 'food',
        name: { en: 'Canned fruit & vegetables', fr: 'Conserves de fruits et légumes' },
      },
      { id: 'coffee', slug: 'coffee', categoryId: 'food', name: { en: 'Coffee', fr: 'Cafés' } },
    ],
    seo: {
      title: {
        en: 'Food & Beverage Products — Wholesale Distribution Tunisia',
        fr: 'Produits agro-alimentaires — Distribution en gros Tunisie',
      },
      description: {
        en: 'Sauces, dressings, syrups, condiments and canned goods for restaurants, hotels and retail across Tunisia. Importer since 1985.',
        fr: 'Sauces, vinaigrettes, sirops, condiments et conserves pour la restauration, l’hôtellerie et la distribution en Tunisie. Importateur depuis 1985.',
      },
    },
  },
  {
    id: 'monin',
    slug: 'monin',
    name: { en: 'MONIN', fr: 'MONIN' },
    shortName: { en: 'MONIN', fr: 'MONIN' },
    description: {
      en: 'Syrups, fruit purées, gourmet sauces, frappé bases and bar accessories for creative beverage service.',
      fr: 'Sirops, purées de fruits, sauces gourmandes, bases frappé et accessoires pour la création de boissons.',
    },
    longDescription: {
      en: 'A dedicated MONIN universe for bars, coffee shops, hotels and restaurants: the complete range currently listed by Vinto, organised into clear professional families and available through one commercial contact.',
      fr: 'Un univers MONIN dédié aux bars, coffee-shops, hôtels et restaurants : toute la gamme actuellement publiée par Vinto, organisée en familles professionnelles claires et accessible auprès d’un seul interlocuteur commercial.',
    },
    image: '/img/video-stills/monin-fraicheur.jpg',
    icon: 'bottle',
    accent: 'var(--c-cat-monin)',
    subcategories: [
      { id: 'syrups', slug: 'syrups', categoryId: 'monin', name: { en: 'Syrups', fr: 'Sirops' } },
      {
        id: 'fruit-purees',
        slug: 'fruit-purees',
        categoryId: 'monin',
        name: { en: 'Fruit purées', fr: 'Purées de fruits' },
      },
      {
        id: 'sauces',
        slug: 'sauces',
        categoryId: 'monin',
        name: { en: 'Gourmet sauces', fr: 'Sauces gourmandes' },
      },
      {
        id: 'frappe-bases',
        slug: 'frappe-bases',
        categoryId: 'monin',
        name: { en: 'Frappé bases', fr: 'Bases frappé' },
      },
      {
        id: 'bar-tools',
        slug: 'bar-tools',
        categoryId: 'monin',
        name: { en: 'Bar accessories', fr: 'Accessoires barista' },
      },
    ],
    seo: {
      title: {
        en: 'MONIN Tunisia — Syrups, Purées, Sauces & Bar Accessories',
        fr: 'MONIN Tunisie — Sirops, purées, sauces et accessoires',
      },
      description: {
        en: 'Explore the MONIN professional range distributed in Tunisia: syrups, fruit purées, sauces, frappé bases and bar accessories.',
        fr: 'Découvrez la gamme professionnelle MONIN distribuée en Tunisie : sirops, purées de fruits, sauces, bases frappé et accessoires barista.',
      },
    },
  },
  {
    id: 'packaging',
    slug: 'packaging',
    name: { en: 'Professional Packaging', fr: 'Emballage professionnel' },
    shortName: { en: 'Packaging', fr: 'Emballage' },
    description: {
      en: 'Verrines, picks, polycarbonate glassware, straws, trays, films and carriers for food service and presentation.',
      fr: 'Verrines, piques, verrerie polycarbonate, pailles, barquettes, films et supports pour la restauration et la présentation.',
    },
    longDescription: {
      en: 'Our broad professional-packaging universe. Single-portion verrines, decorative picks, unbreakable polycarbonate glassware, gastronorm containers, aluminium trays, stretch films and food-grade papers — the working materials of professional presentation and food handling.',
      fr: 'Notre vaste univers d’emballage professionnel. Verrines monoportion, piques décoratifs, verrerie polycarbonate incassable, bacs gastronormes, barquettes aluminium, films étirables et papiers alimentaires : les matériaux de travail de la présentation professionnelle et de la manipulation alimentaire.',
    },
    image: '/img/categories/packaging.jpg',
    icon: 'container',
    accent: 'var(--c-cat-packaging)',
    subcategories: [
      {
        id: 'verrines',
        slug: 'verrines',
        categoryId: 'packaging',
        name: { en: 'Verrines & single-portion', fr: 'Verrines et monoportions' },
      },
      {
        id: 'picks',
        slug: 'picks',
        categoryId: 'packaging',
        name: { en: 'Picks & skewers', fr: 'Piques et brochettes' },
      },
      {
        id: 'glassware',
        slug: 'glassware',
        categoryId: 'packaging',
        name: { en: 'Polycarbonate glassware', fr: 'Verrerie polycarbonate' },
      },
      {
        id: 'straws',
        slug: 'straws',
        categoryId: 'packaging',
        name: { en: 'Straws', fr: 'Pailles' },
      },
      {
        id: 'trays-containers',
        slug: 'trays-containers',
        categoryId: 'packaging',
        name: { en: 'Trays & containers', fr: 'Barquettes et bacs' },
      },
      {
        id: 'films-papers',
        slug: 'films-papers',
        categoryId: 'packaging',
        name: { en: 'Films, foils & papers', fr: 'Films, aluminium et papiers' },
      },
      {
        id: 'bags-carriers',
        slug: 'bags-carriers',
        categoryId: 'packaging',
        name: { en: 'Bags & carriers', fr: 'Sachets et supports' },
      },
      {
        id: 'cutlery-serving',
        slug: 'cutlery-serving',
        categoryId: 'packaging',
        name: { en: 'Cutlery & serving', fr: 'Couverts et service' },
      },
      {
        id: 'equipment',
        slug: 'equipment',
        categoryId: 'packaging',
        name: { en: 'Equipment', fr: 'Équipement' },
      },
    ],
    seo: {
      title: {
        en: 'Professional Packaging — Verrines, Trays & Films Tunisia',
        fr: 'Emballage professionnel — Verrines, barquettes et films Tunisie',
      },
      description: {
        en: 'Verrines, picks, polycarbonate glassware, gastronorm containers, aluminium trays and food-grade films for professional kitchens in Tunisia.',
        fr: 'Verrines, piques, verrerie polycarbonate, bacs gastronormes, barquettes aluminium et films alimentaires pour les cuisines professionnelles en Tunisie.',
      },
    },
  },
  {
    id: 'hygiene',
    slug: 'hygiene',
    name: { en: 'Hygiene & Disposables', fr: 'Hygiène et jetable' },
    shortName: { en: 'Hygiene', fr: 'Hygiène' },
    description: {
      en: 'Gloves, caps, aprons, masks, overshoes and paper products for food handling, healthcare and pharmaceutical environments.',
      fr: "Gants, calots, tabliers, masques, surchaussures et papiers pour la manipulation alimentaire, la santé et l'industrie pharmaceutique.",
    },
    longDescription: {
      en: 'Single-use protection for environments where contamination control matters: vinyl, latex and polyethylene gloves, caps and hair nets, disposable aprons and sleeve covers, paper masks, PVC overshoes, cellulose rolls and pastry papers.',
      fr: 'La protection à usage unique pour les environnements où la maîtrise de la contamination est essentielle : gants vinyle, latex et polyéthylène, calots et coiffes, tabliers et manchettes jetables, masques papier, surchaussures PVC, rouleaux cellulose et papiers pâtissiers.',
    },
    image: '/img/categories/hygiene.jpg',
    icon: 'shield',
    accent: 'var(--c-cat-hygiene)',
    subcategories: [
      { id: 'gloves', slug: 'gloves', categoryId: 'hygiene', name: { en: 'Gloves', fr: 'Gants' } },
      {
        id: 'headwear',
        slug: 'headwear',
        categoryId: 'hygiene',
        name: { en: 'Caps & hair nets', fr: 'Calots et coiffes' },
      },
      {
        id: 'aprons-sleeves',
        slug: 'aprons-sleeves',
        categoryId: 'hygiene',
        name: { en: 'Aprons & sleeves', fr: 'Tabliers et manchettes' },
      },
      { id: 'masks', slug: 'masks', categoryId: 'hygiene', name: { en: 'Masks', fr: 'Masques' } },
      {
        id: 'paper-wiping',
        slug: 'paper-wiping',
        categoryId: 'hygiene',
        name: { en: 'Paper & wiping', fr: 'Papiers et essuyage' },
      },
      {
        id: 'doilies',
        slug: 'doilies',
        categoryId: 'hygiene',
        name: { en: 'Doilies & pastry papers', fr: 'Papiers dentelle et pâtisserie' },
      },
      {
        id: 'footwear',
        slug: 'footwear',
        categoryId: 'hygiene',
        name: { en: 'Overshoes', fr: 'Surchaussures' },
      },
      {
        id: 'cleaning-chemicals',
        slug: 'cleaning-chemicals',
        categoryId: 'hygiene',
        name: { en: 'Cleaning chemicals', fr: 'Produits de nettoyage' },
      },
    ],
    seo: {
      title: {
        en: 'Hygiene & Disposable Products — Gloves, Masks, Aprons Tunisia',
        fr: 'Produits d’hygiène et jetables — Gants, masques, tabliers Tunisie',
      },
      description: {
        en: 'Disposable gloves, caps, aprons, masks and paper products for food handling, healthcare and pharmaceutical environments in Tunisia.',
        fr: "Gants jetables, calots, tabliers, masques et papiers pour la manipulation alimentaire, la santé et l'industrie pharmaceutique en Tunisie.",
      },
    },
  },
];
