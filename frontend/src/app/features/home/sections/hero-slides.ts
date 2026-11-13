import { CategoryId } from '../../../shared/models/catalog.model';

/** One promotional banner. All visible text lives in i18n, under `home.hero.slides.<id>`. */
export interface HeroSlide {
  readonly id: string;
  /** File stem under /img/home/banners: `-2000`, `-1280` and `-mobile` variants exist. */
  readonly image: string;
  readonly categoryId: CategoryId;
  /** Catalogue slug the call to action opens; the division is the fallback if it disappears. */
  readonly productSlug: string;
}

/** Brands withdrawn from this campaign; their products stay in the catalogue. */
export const CAMPAIGN_EXCLUDED_BRANDS: ReadonlySet<string> = new Set(['emporium', 'varvello']);

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'dijona',
    image: 'dijona',
    categoryId: 'food',
    productSlug: 'moutarde-de-dijon-dijona-200g',
  },
  {
    id: 'mayor',
    image: 'mayor',
    categoryId: 'food',
    productSlug: 'mayonnaise-mayor-riche-cremeuse-350-ml',
  },
  {
    id: 'moninFraise',
    image: 'monin-fraise',
    categoryId: 'monin',
    productSlug: 'sirop-de-fraise-monin-25cl',
  },
  {
    id: 'moninPassion',
    image: 'monin-passion',
    categoryId: 'monin',
    productSlug: 'puree-de-fruit-de-la-passion-monin',
  },
  {
    id: 'bolKraft',
    image: 'bol-kraft',
    categoryId: 'packaging',
    productSlug: 'bol-a-salade-kraft-avec-couvercle',
  },
  {
    id: 'gobeletsPet',
    image: 'gobelets-pet',
    categoryId: 'packaging',
    productSlug: 'gobelet-et-couvercle-en-pet-350ml',
  },
  {
    id: 'gantsNitrile',
    image: 'gants-nitrile',
    categoryId: 'hygiene',
    productSlug: 'gants-en-nitrile-bleus-boite-de-100',
  },
  {
    id: 'coiffes',
    image: 'coiffes',
    categoryId: 'hygiene',
    productSlug: 'coiffe-de-protection',
  },
];
