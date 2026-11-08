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
    productSlug: 'vinto-moutarde-forte-de-dijon-dijona-200gr-27',
  },
  {
    id: 'mayor',
    image: 'mayor',
    categoryId: 'food',
    productSlug: 'vinto-mayonnaise-mayor-350-ml-384',
  },
  {
    id: 'moninFraise',
    image: 'monin-fraise',
    categoryId: 'monin',
    productSlug: 'monin-sirop-de-fraise-monin-1l-326',
  },
  {
    id: 'moninPassion',
    image: 'monin-passion',
    categoryId: 'monin',
    productSlug: 'monin-sirop-fruit-de-la-passion-1l',
  },
  {
    id: 'bolKraft',
    image: 'bol-kraft',
    categoryId: 'packaging',
    productSlug: 'vinto-bol-a-salade-500ml-en-kraft-brun-avec-couvercle-en-pet-les-50-pieces-82',
  },
  {
    id: 'gobeletsPet',
    image: 'gobelets-pet',
    categoryId: 'packaging',
    productSlug: 'vinto-gobelet-et-couvercle-en-pet-12oz-350-ml-les-50-pieces-48',
  },
  {
    id: 'gantsNitrile',
    image: 'gants-nitrile',
    categoryId: 'hygiene',
    productSlug: 'vinto-gant-nitrile-les-100-pieces-355-64',
  },
  {
    id: 'coiffes',
    image: 'coiffes',
    categoryId: 'hygiene',
    productSlug: 'vinto-coiffe-bouffant-en-non-tisse-les-100-pieces-146',
  },
];
