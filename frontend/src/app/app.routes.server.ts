import { RenderMode, ServerRoute } from '@angular/ssr';
import { LOCALES } from './shared/models/localized-text.model';

/**
 * Rendering modes.
 *
 * Every page that shows catalogue data is rendered per request from the
 * database, through the API: the home page (showcase, offers, counters), the
 * catalogue and its pages (`?page=2` is a different page, which a prerendered
 * file could not honour), the division listings, every product page, and the
 * brand directory's counts. A product added, edited or deactivated in the back
 * office is therefore live on the next request — nothing to regenerate and no
 * catalogue compiled into the application.
 *
 * Pages without catalogue data are prerendered at build time for a
 * sub-second TTFB. Their header counter loads in the browser.
 */

const localeParams = LOCALES.map((lang) => ({ lang }));

/** Pages whose content is the same for every request and holds no catalogue data. */
const STATIC_ROUTES = ['about', 'industries', 'contact', 'privacy', 'terms', '404'] as const;

export const serverRoutes: ServerRoute[] = [
  ...STATIC_ROUTES.map((segment): ServerRoute => ({
    path: `:lang/${segment}`,
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => Promise.resolve(localeParams),
  })),
  { path: ':lang', renderMode: RenderMode.Server },
  { path: ':lang/products', renderMode: RenderMode.Server },
  { path: ':lang/products/:category', renderMode: RenderMode.Server },
  { path: ':lang/products/:category/:slug', renderMode: RenderMode.Server },
  { path: ':lang/brands', renderMode: RenderMode.Server },
  // Everything else — the bare `/`, legacy WordPress URLs and unknown paths —
  // is server-rendered so the redirect map can run and unknown URLs still
  // receive a real 404 page rather than a static shell.
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
