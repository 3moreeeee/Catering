import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEFAULT_LOCALE, isLocale } from '../../shared/models/localized-text.model';
import { LocaleService } from '../i18n/locale.service';
import { LEGACY_REDIRECTS } from '../config/site.config';

/**
 * Validates the `:lang` segment and publishes it to `LocaleService`.
 *
 * This guard also owns the legacy-URL redirects, and it has to: the `:lang`
 * route pattern matches any single segment, so `/agro-alimentaire` is captured
 * here before the wildcard route is ever reached. Handling the map anywhere
 * else would silently send every inbound link from the old WordPress site to
 * the homepage instead of its real destination.
 *
 * An unknown prefix that is not a legacy URL is not a 404 either — it is
 * treated as a path under the default locale and redirected, so a mistyped or
 * very old link still lands somewhere useful.
 */
export const localeGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const locales = inject(LocaleService);
  const lang = route.paramMap.get('lang');

  if (isLocale(lang)) {
    locales.set(lang);
    return true;
  }

  // Rebuild the requested path from the URL the router actually matched.
  const path = state.url.split('?')[0]?.split('#')[0] ?? '/';
  const normalized = path.replace(/\/+$/, '') || '/';

  const legacy = LEGACY_REDIRECTS[normalized] ?? LEGACY_REDIRECTS[`${normalized}/`];
  if (legacy) {
    return router.parseUrl(legacy);
  }

  const fragment = state.url.split('#')[1];
  return router.createUrlTree([DEFAULT_LOCALE], {
    queryParams: route.queryParams,
    ...(fragment ? { fragment } : {}),
  });
};
