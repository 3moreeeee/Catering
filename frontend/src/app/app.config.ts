import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';

import { routes } from './app.routes';
import { HttpTranslocoLoader } from './core/i18n/transloco-loader';
import { LOCALES, DEFAULT_LOCALE } from './shared/models/localized-text.model';
import {
  BRAND_REPOSITORY,
  CATEGORY_REPOSITORY,
  INDUSTRY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from './data/repositories/catalog.repository';
import {
  InMemoryBrandRepository,
  InMemoryCategoryRepository,
  InMemoryIndustryRepository,
} from './data/repositories/in-memory.repository';
import { ApiProductRepository } from './data/repositories/api-product.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        // Restore position on back/forward; jump to top on a new navigation.
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    // Incremental hydration. Without it, every `@defer` block renders only its
    // placeholder on the server, so the homepage reached crawlers as a hero and
    // nothing else — no statement, no divisions, none of the twenty-one family
    // links. With it the server renders the real content and only the
    // JavaScript stays deferred, which is the combination this page needs:
    // indexable HTML and a critical path that carries no chapter code.
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    provideHttpClient(withFetch()),
    provideTransloco({
      config: {
        availableLangs: [...LOCALES],
        defaultLang: DEFAULT_LOCALE,
        fallbackLang: DEFAULT_LOCALE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: isDevMode(), useFallbackTranslation: true },
      },
      loader: HttpTranslocoLoader,
    }),

    // ── The CMS seam ─────────────────────────────────────────────────────────
    // Replacing these four providers with HTTP or GraphQL implementations moves
    // the entire site onto a live CMS. Nothing else changes.
    { provide: PRODUCT_REPOSITORY, useExisting: ApiProductRepository },
    { provide: CATEGORY_REPOSITORY, useExisting: InMemoryCategoryRepository },
    { provide: BRAND_REPOSITORY, useExisting: InMemoryBrandRepository },
    { provide: INDUSTRY_REPOSITORY, useExisting: InMemoryIndustryRepository },
  ],
};
