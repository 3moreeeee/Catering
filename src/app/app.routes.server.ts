import { RenderMode, ServerRoute } from '@angular/ssr';
import { LOCALES } from './shared/models/localized-text.model';
import { PRODUCTS } from './data/products.data';
import { CATEGORIES } from './data/categories.data';

/**
 * Prerendering.
 *
 * The whole site is statically generated at build time: 18 locale-only pages,
 * Category and product pages are generated from the live catalogue arrays,
 * so newly added commercial universes are automatically indexed.
 * Every product is therefore indexable, and every page has a
 * sub-second TTFB with no server render on the critical path.
 *
 * Catalogue *filter* permutations are deliberately not prerendered — they are
 * canonicalised to the unfiltered list (see `CatalogPage`) and served by SSR,
 * so the index is not flooded with near-duplicate facet URLs.
 */

const localeParams = LOCALES.map((lang) => ({ lang }));

/** Static routes that vary only by locale. */
const LOCALE_ONLY_ROUTES = [
  '',
  'about',
  'products',
  'brands',
  'industries',
  'contact',
  'privacy',
  'terms',
  '404',
] as const;

export const serverRoutes: ServerRoute[] = [
  ...LOCALE_ONLY_ROUTES.map((segment): ServerRoute => ({
    path: segment ? `:lang/${segment}` : ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => localeParams,
  })),
  {
    path: ':lang/products/:category',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () =>
      LOCALES.flatMap((lang) => CATEGORIES.map((category) => ({ lang, category: category.slug }))),
  },
  {
    // Every current product in both locales.
    path: ':lang/products/:category/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () =>
      LOCALES.flatMap((lang) =>
        PRODUCTS.map((product) => ({
          lang,
          category: CATEGORIES.find((c) => c.id === product.categoryId)?.slug ?? product.categoryId,
          slug: product.slug,
        })),
      ),
  },
  // Everything else — the bare `/`, legacy WordPress URLs and unknown paths —
  // is server-rendered so the redirect map can run and unknown URLs still
  // receive a real 404 page rather than a static shell.
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
