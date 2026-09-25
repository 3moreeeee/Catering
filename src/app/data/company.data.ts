// =============================================================================
// COMPANY DATA
//
// Every contact detail below was read from the live legacy site on 2026-08-06.
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ NEEDS_VERIFICATION — BLOCKING BEFORE LAUNCH                               │
// │ The business owner must confirm each field marked below. Do not publish   │
// │ with unverified contact details. See docs/02-sitemap-and-flows.md §2.4.   │
// └───────────────────────────────────────────────────────────────────────────┘
// =============================================================================

import { LocalizedText } from '../shared/models/localized-text.model';

export interface CompanyContact {
  readonly legalName: string;
  readonly tradingName: string;
  readonly foundedYear: number;
  readonly address: {
    readonly street: string;
    readonly locality: string;
    readonly postalCode: string;
    readonly region: string;
    readonly country: string;
    readonly countryCode: string;
  };
  readonly telephone: string;
  readonly telephoneDisplay: string;
  readonly fax?: string;
  readonly faxDisplay?: string;
  readonly email: string;
  /** Null until the owner supplies them — the UI shows a placeholder, not fake hours. */
  readonly businessHours: LocalizedText | null;
  readonly geo: { readonly lat: number; readonly lng: number } | null;
  readonly social: readonly { readonly platform: string; readonly url: string }[];
}

export const COMPANY: CompanyContact = {
  legalName: 'Société Ferid Khemakhem',
  tradingName: 'Catering',
  // VERIFIED: stated in the founder's message — "A sa création en 1985…"
  foundedYear: 1985,
  address: {
    // VERIFIED (source string: "Zone Industrielle M'nihla 2094 Tunis")
    street: "Zone Industrielle M'nihla",
    locality: 'Tunis',
    postalCode: '2094',
    // NEEDS_VERIFICATION: M'nihla is administratively in the Ariana governorate,
    // while the source writes "Tunis". Confirm the correct postal designation.
    region: 'Tunis',
    country: 'Tunisia',
    countryCode: 'TN',
  },
  // VERIFIED (source: +21671557548)
  telephone: '+21671557548',
  telephoneDisplay: '+216 71 557 548',
  // NEEDS_VERIFICATION: confirm the fax line is still in service. If it is not,
  // remove it rather than publish a dead number — see docs/01-audit.md.
  fax: '+21671557475',
  faxDisplay: '+216 71 557 475',
  // VERIFIED (source: contact@catering.com.tn)
  email: 'contact@catering.com.tn',
  // NEEDS_VERIFICATION: not stated anywhere on the legacy site.
  businessHours: null,
  // NEEDS_VERIFICATION: no coordinates published. Required for the map and for
  // LocalBusiness structured data. Until supplied, the map renders as a static
  // link-out rather than a pin in the wrong place.
  geo: null,
  social: [
    // VERIFIED: the only social link on the legacy site that resolves.
    { platform: 'facebook', url: 'https://www.facebook.com/FK-MONIN-Tunisia-969019779799681/' },
    // REMOVED from the legacy footer: plus.google.com (Google+ shut down in
    // 2019), twitter.com (bare domain, no account), rss.com. Publishing dead
    // social links damages exactly the credibility this redesign is built on.
  ],
};

/**
 * The founder's message, preserved from the legacy site.
 *
 * The French text is the company's own words. Punctuation and accents are
 * normalised (the source omits several commas and mangles accents); no wording
 * is changed and no claim is added.
 *
 * NEEDS_VERIFICATION: the English text is a translation produced for this
 * redesign. It must be approved by the company before launch.
 */
export const PRESIDENT_MESSAGE: readonly LocalizedText[] = [
  {
    fr: "À sa création en 1985, la Société Ferid Khemakhem a concentré son activité sur l'importation de trois familles de produits : l'agroalimentaire, l'hygiène et l'emballage.",
    en: 'When it was founded in 1985, Société Ferid Khemakhem focused its activity on importing three product families: food, hygiene and packaging.',
  },
  {
    fr: "Nos clients partenaires opèrent sur des secteurs variés comme la restauration, la grande distribution, la santé et l'industrie pharmaceutique.",
    en: 'Our client partners operate across varied sectors such as food service, mass retail, healthcare and the pharmaceutical industry.',
  },
  {
    fr: "Afin de fournir à nos clients des produits de qualité répondant aux normes européennes et internationales, nous avons soigneusement sélectionné nos fournisseurs, dotés des plus hautes certifications mondialement reconnues.",
    en: 'In order to supply our clients with quality products meeting European and international standards, we have carefully selected suppliers holding the highest internationally recognised certifications.',
  },
  {
    fr: "Par ailleurs, nous œuvrons sans cesse à l'enrichissement de notre gamme de produits en scrutant l'évolution des tendances mondiales, et anticiper ainsi vos attentes.",
    en: 'We also work continuously to broaden our product range by following the evolution of global trends, and so anticipate your expectations.',
  },
  {
    fr: "Le conseil et l'assistance, aussi bien commerciale que technique, sont parmi nos préoccupations majeures.",
    en: 'Advice and support, both commercial and technical, are among our foremost concerns.',
  },
  {
    fr: "En un mot, notre but n'est pas de vendre mais de tisser de réels liens de partenariat avec nos clients.",
    en: 'In a word: our aim is not to sell, but to build genuine partnerships with our clients.',
  },
];

/**
 * Company values. Each is directly supported by a statement in the founder's
 * message above — none is stronger than its source.
 *
 * There are deliberately NO numeric statistics here. The company has published
 * no client count, employee count, SKU count or turnover figure, and the brief
 * forbids inventing them.
 */
export const COMPANY_VALUES: readonly {
  readonly id: string;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
}[] = [
  {
    id: 'established',
    title: { en: 'Established in 1985', fr: 'Établie en 1985' },
    body: {
      en: 'Four decades importing and distributing for Tunisian professionals, through three product divisions built and maintained since the company was founded.',
      fr: "Quatre décennies d'importation et de distribution pour les professionnels tunisiens, à travers une sélection d'univers produits spécialisés.",
    },
  },
  {
    id: 'selection',
    title: { en: 'Carefully selected suppliers', fr: 'Des fournisseurs soigneusement sélectionnés' },
    body: {
      en: 'Suppliers are chosen against European and international standards, so that what reaches your kitchen or production line meets a consistent specification.',
      fr: 'Nos fournisseurs sont choisis selon les normes européennes et internationales, afin que ce qui arrive dans votre cuisine ou sur votre ligne de production réponde à une spécification constante.',
    },
  },
  {
    id: 'range',
    title: { en: 'Three complete divisions', fr: 'Trois divisions complètes' },
    body: {
      en: 'Food, packaging and hygiene from a single supplier — one relationship, one delivery, one point of contact instead of three.',
      fr: "Agro-alimentaire, emballage et hygiène chez un seul fournisseur : une relation, une livraison, un interlocuteur au lieu de trois.",
    },
  },
  {
    id: 'support',
    title: { en: 'Commercial and technical support', fr: 'Conseil commercial et technique' },
    body: {
      en: 'Advice and assistance are part of the offer, not an extra. Our aim is not simply to sell, but to build a working partnership.',
      fr: "Le conseil et l'assistance font partie de l'offre, non d'un supplément. Notre but n'est pas simplement de vendre, mais de bâtir un véritable partenariat.",
    },
  },
];

/**
 * Company milestones for the About-page timeline.
 *
 * NEEDS_VERIFICATION: only the 1985 founding date is documented. The company
 * must supply any further dated milestones (premises, brand agencies,
 * division launches). Until then the timeline shows the founding and the
 * present day only — an honest short timeline beats an invented long one.
 */
/**
 * The milestones that may be shown to visitors.
 *
 * The full record below deliberately keeps the gap in the company's history as
 * a data entry, because that is the honest model and it is what the launch
 * blocker list is generated from. It must never be rendered: an item titled
 * "Étape à renseigner" whose body begins "NEEDS_VERIFICATION" was appearing on
 * the public About page. Templates read this filtered view instead.
 */
export const PUBLISHED_MILESTONES = () => COMPANY_MILESTONES.filter((m) => m.verified);

export const COMPANY_MILESTONES: readonly {
  readonly year: number | null;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly verified: boolean;
}[] = [
  {
    year: 1985,
    title: { en: 'The company is founded', fr: "Création de l'entreprise" },
    body: {
      en: 'Société Ferid Khemakhem begins trading, concentrating on the import of three product families: food, hygiene and packaging.',
      fr: "La Société Ferid Khemakhem démarre son activité, concentrée sur l'importation de trois familles de produits : agroalimentaire, hygiène et emballage.",
    },
    verified: true,
  },
  {
    year: null,
    title: { en: 'Milestone pending', fr: 'Étape à renseigner' },
    body: {
      en: 'NEEDS_VERIFICATION — the company has not published dated milestones between 1985 and today. Add premises, brand agency agreements or division launches here.',
      fr: "NEEDS_VERIFICATION — l'entreprise n'a publié aucune étape datée entre 1985 et aujourd'hui. Ajouter ici les locaux, les accords de représentation ou les lancements de divisions.",
    },
    verified: false,
  },
];
