// =============================================================================
// INDUSTRIES
//
// `sourceVerified: true` means the sector is named verbatim in the founder's
// message on the legacy site:
//   « Nos clients partenaires opèrent sur des secteurs variés comme la
//     restauration, la grande distribution la santé et l'industrie
//     pharmaceutique. »
//
// `sourceVerified: false` means the sector comes from the redesign brief and
// is plausible for this business, but is NOT stated by the company. The UI
// renders these without any claim of existing client relationships.
// =============================================================================

import { Industry } from '../shared/models/catalog.model';

export const INDUSTRIES: readonly Industry[] = [
  {
    id: 'restaurants',
    slug: 'restaurants-cafes',
    name: { en: 'Restaurants & Cafés', fr: 'Restauration et cafés' },
    description: {
      en: 'Independent restaurants, coffee shops, bars and quick-service kitchens.',
      fr: 'Restaurants indépendants, coffee shops, bars et cuisines de restauration rapide.',
    },
    howWeSupport: {
      en: 'Bar syrups and frappé bases, sauces and dressings in service formats, single-portion verrines and picks for presentation, unbreakable polycarbonate glassware, straws, carry-out bags and the disposable hygiene range kitchens need daily.',
      fr: 'Sirops de bar et bases frappé, sauces et vinaigrettes en formats service, verrines monoportion et piques de présentation, verrerie polycarbonate incassable, pailles, sachets à emporter et la gamme hygiène jetable dont les cuisines ont besoin au quotidien.',
    },
    icon: 'restaurant',
    relevantCategories: ['food', 'monin', 'packaging', 'hygiene'],
    sourceVerified: true,
    seo: {
      title: {
        en: 'Supplying Restaurants & Cafés in Tunisia',
        fr: 'Fournisseur pour la restauration et les cafés en Tunisie',
      },
      description: {
        en: 'Food, packaging and hygiene supplies for restaurants, cafés and bars across Tunisia. Importer and distributor since 1985.',
        fr: 'Produits alimentaires, emballage et hygiène pour les restaurants, cafés et bars en Tunisie. Importateur et distributeur depuis 1985.',
      },
    },
  },
  {
    id: 'hotels',
    slug: 'hotels-catering',
    name: { en: 'Hotels & Catering', fr: 'Hôtellerie et traiteurs' },
    description: {
      en: 'Hotel kitchens, banqueting operations and catering companies.',
      fr: 'Cuisines hôtelières, banquets et sociétés de traiteur.',
    },
    howWeSupport: {
      en: 'Volume formats for breakfast and banqueting service, presentation verrines and picks for buffets and canapés, gastronorm containers, and the full disposable hygiene range for brigades working to HACCP procedures.',
      fr: 'Formats collectivité pour le petit-déjeuner et le service banquet, verrines et piques de présentation pour buffets et canapés, bacs gastronormes, et la gamme hygiène jetable complète pour les brigades travaillant selon les procédures HACCP.',
    },
    icon: 'hotel',
    relevantCategories: ['food', 'monin', 'packaging', 'hygiene'],
    // Implied by "la restauration" but not named separately by the company.
    sourceVerified: false,
    seo: {
      title: {
        en: 'Supplying Hotels & Catering Operations in Tunisia',
        fr: "Fournisseur pour l'hôtellerie et les traiteurs en Tunisie",
      },
      description: {
        en: 'Food, packaging and hygiene supplies for hotel kitchens, banqueting and catering companies in Tunisia.',
        fr: 'Produits alimentaires, emballage et hygiène pour les cuisines hôtelières, les banquets et les traiteurs en Tunisie.',
      },
    },
  },
  {
    id: 'retail',
    slug: 'retail-supermarkets',
    name: { en: 'Retail & Supermarkets', fr: 'Grande distribution' },
    description: {
      en: 'Supermarket chains, convenience retail and their in-store production counters.',
      fr: 'Chaînes de supermarchés, commerces de proximité et leurs laboratoires en magasin.',
    },
    howWeSupport: {
      en: 'Retail-format food lines, and the packaging and hygiene consumables that in-store bakery, pastry, delicatessen and butchery counters consume continuously — trays, films, doily papers, gloves and caps.',
      fr: "Gammes alimentaires en formats distribution, ainsi que les consommables d'emballage et d'hygiène que consomment en continu les rayons boulangerie, pâtisserie, traiteur et boucherie : barquettes, films, papiers dentelle, gants et calots.",
    },
    icon: 'retail',
    relevantCategories: ['food', 'monin', 'packaging', 'hygiene'],
    sourceVerified: true,
    seo: {
      title: {
        en: 'Supplying Retail & Supermarkets in Tunisia',
        fr: 'Fournisseur pour la grande distribution en Tunisie',
      },
      description: {
        en: 'Food, packaging and hygiene supplies for supermarkets and retail chains in Tunisia. Importer since 1985.',
        fr: 'Produits alimentaires, emballage et hygiène pour la grande distribution en Tunisie. Importateur depuis 1985.',
      },
    },
  },
  {
    id: 'food-production',
    slug: 'food-production',
    name: { en: 'Food Production', fr: 'Industrie agro-alimentaire' },
    description: {
      en: 'Food manufacturers, central kitchens and processing operations.',
      fr: 'Industriels de l’agro-alimentaire, cuisines centrales et unités de transformation.',
    },
    howWeSupport: {
      en: 'Bulk ingredient formats, food-grade films, foils and papers for wrapping and portioning, gastronorm and aluminium containers, and the personal-protection consumables required on a production line — gloves, caps, masks, aprons, sleeve covers and overshoes.',
      fr: 'Formats vrac pour les ingrédients, films, aluminium et papiers alimentaires pour le conditionnement et le portionnement, bacs gastronormes et barquettes aluminium, et les consommables de protection individuelle requis sur une ligne de production : gants, calots, masques, tabliers, manchettes et surchaussures.',
    },
    icon: 'factory',
    relevantCategories: ['food', 'packaging', 'hygiene'],
    sourceVerified: false,
    seo: {
      title: {
        en: 'Supplying Food Production in Tunisia',
        fr: "Fournisseur pour l'industrie agro-alimentaire en Tunisie",
      },
      description: {
        en: 'Ingredients, food-grade packaging and protective consumables for food manufacturers and central kitchens in Tunisia.',
        fr: "Ingrédients, emballages alimentaires et consommables de protection pour les industriels de l'agro-alimentaire en Tunisie.",
      },
    },
  },
  {
    id: 'healthcare',
    slug: 'healthcare',
    name: { en: 'Healthcare', fr: 'Santé' },
    description: {
      en: 'Hospitals, clinics, laboratories and care facilities.',
      fr: 'Hôpitaux, cliniques, laboratoires et établissements de soins.',
    },
    howWeSupport: {
      en: 'Single-use protection where contamination control is the requirement: vinyl, latex and polyethylene gloves, caps and hair nets, paper masks, disposable aprons and sleeve covers, overshoes, and cellulose paper rolls. Catering-facing formats are available for hospital kitchens.',
      fr: "La protection à usage unique là où la maîtrise de la contamination est l'exigence : gants vinyle, latex et polyéthylène, calots et coiffes, masques papier, tabliers et manchettes jetables, surchaussures et rouleaux de papier cellulose. Des formats restauration sont disponibles pour les cuisines hospitalières.",
    },
    icon: 'health',
    relevantCategories: ['hygiene', 'packaging'],
    sourceVerified: true,
    seo: {
      title: {
        en: 'Supplying Healthcare Facilities in Tunisia',
        fr: 'Fournisseur pour le secteur de la santé en Tunisie',
      },
      description: {
        en: 'Disposable gloves, masks, caps, aprons and paper products for hospitals, clinics and laboratories in Tunisia.',
        fr: 'Gants, masques, calots, tabliers et papiers jetables pour les hôpitaux, cliniques et laboratoires en Tunisie.',
      },
    },
  },
  {
    id: 'pharmaceutical',
    slug: 'pharmaceutical',
    name: { en: 'Pharmaceutical Industries', fr: 'Industrie pharmaceutique' },
    description: {
      en: 'Pharmaceutical manufacturing, packaging and distribution operations.',
      fr: 'Fabrication, conditionnement et distribution pharmaceutiques.',
    },
    howWeSupport: {
      en: 'Controlled-environment consumables: gloves in vinyl, latex and polyethylene, hair nets and clip-on caps, masks, disposable aprons, sleeve covers and PVC overshoes — supplied in the volumes and consistency a regulated production environment requires.',
      fr: "Consommables pour environnements contrôlés : gants vinyle, latex et polyéthylène, coiffes et calots à clip, masques, tabliers jetables, manchettes et surchaussures PVC, fournis dans les volumes et la régularité qu'exige un environnement de production réglementé.",
    },
    icon: 'pharma',
    relevantCategories: ['hygiene'],
    sourceVerified: true,
    seo: {
      title: {
        en: 'Supplying Pharmaceutical Industries in Tunisia',
        fr: "Fournisseur pour l'industrie pharmaceutique en Tunisie",
      },
      description: {
        en: 'Gloves, masks, caps, aprons and overshoes for pharmaceutical manufacturing and packaging operations in Tunisia.',
        fr: 'Gants, masques, calots, tabliers et surchaussures pour la fabrication et le conditionnement pharmaceutiques en Tunisie.',
      },
    },
  },
];
