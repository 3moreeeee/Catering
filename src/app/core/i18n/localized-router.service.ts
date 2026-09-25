import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Locale } from '../../shared/models/localized-text.model';
import { LocaleService } from './locale.service';

/**
 * The single sanctioned way to build an internal link.
 *
 * Components never hardcode `/en/...` or `/fr/...`. They ask for a logical path
 * and get it prefixed with the active locale — so adding a third language is a
 * data change, not a find-and-replace across every template.
 */
@Injectable({ providedIn: 'root' })
export class LocalizedRouter {
  private readonly locales = inject(LocaleService);
  private readonly router = inject(Router);

  /** `path('products/food')` → `['/fr', 'products', 'food']` */
  path(segments: string | readonly string[], locale?: Locale): string[] {
    const parts = (typeof segments === 'string' ? segments.split('/') : segments)
      .flatMap((s) => s.split('/'))
      .filter((s) => s.length > 0);
    return [`/${locale ?? this.locales.locale()}`, ...parts];
  }

  /** Absolute URL path as a string, for canonical/hreflang/sitemap use. */
  url(segments: string | readonly string[], locale?: Locale): string {
    return this.path(segments, locale).join('/').replace(/^\/\//, '/');
  }

  navigate(segments: string | readonly string[], extras?: { queryParams?: Record<string, unknown> }): Promise<boolean> {
    return this.router.navigate(this.path(segments), extras);
  }

  /**
   * Rewrites the current URL into the other locale, preserving the path,
   * query string and fragment — so switching language never loses the user's
   * place or their active filters.
   */
  switchLocaleUrl(target: Locale): string {
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments.map((s) => s.path) ?? [];
    // Drop the existing locale prefix, keep everything after it.
    const rest = segments.slice(1);
    tree.root.children['primary'] = this.router.createUrlTree([target, ...rest]).root
      .children['primary']!;
    return this.router.serializeUrl(tree);
  }
}
