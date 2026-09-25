import { Component, ChangeDetectionStrategy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DEFAULT_LOCALE, isLocale } from '../../shared/models/localized-text.model';
import { LEGACY_REDIRECTS } from '../config/site.config';

/**
 * Handles `/` and any unprefixed path.
 *
 * Legacy URLs from the WordPress site (`/agro-alimentaire/`, `/produits/`, …)
 * are mapped to their new equivalents so the old site's inbound links and
 * search-engine history are not thrown away. Everything else falls through to
 * the negotiated locale's homepage.
 */
@Component({
  selector: 'fk-locale-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class LocaleRedirectComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // `router.url` is not yet the requested URL while this component is being
    // constructed mid-navigation — it still holds the previous one, which sent
    // every legacy WordPress path to the locale homepage instead of its mapped
    // destination. The activated route's own segments are the reliable source.
    const segments = this.route.snapshot.url.map((segment) => segment.path);
    const normalized = segments.length ? `/${segments.join('/')}` : '/';

    const legacy = LEGACY_REDIRECTS[normalized] ?? LEGACY_REDIRECTS[`${normalized}/`];
    if (legacy) {
      void this.router.navigateByUrl(legacy, { replaceUrl: true });
      return;
    }

    void this.router.navigate([this.negotiate()], { replaceUrl: true });
  }

  private negotiate(): string {
    if (!this.isBrowser) {
      return DEFAULT_LOCALE;
    }
    const base = navigator.language?.split('-')[0]?.toLowerCase() ?? '';
    return isLocale(base) ? base : DEFAULT_LOCALE;
  }
}
