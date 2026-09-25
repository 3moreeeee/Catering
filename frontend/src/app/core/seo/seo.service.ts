import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_CONFIG } from '../config/site.config';
import { LocaleService } from '../i18n/locale.service';
import { Locale } from '../../shared/models/localized-text.model';

export interface SeoInput {
  readonly title: string;
  readonly description: string;
  /** Logical path without the locale prefix, e.g. `products/food`. */
  readonly path: string;
  readonly image?: string | undefined;
  readonly type?: 'website' | 'article' | 'product' | undefined;
  readonly noIndex?: boolean | undefined;
}

/**
 * Route-level metadata: title, description, canonical, hreflang, Open Graph and
 * X/Twitter cards.
 *
 * Runs on the server as well as the client, so crawlers receive complete tags in
 * the initial HTML rather than after hydration.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(SITE_CONFIG);
  private readonly locales = inject(LocaleService);

  apply(input: SeoInput): void {
    const suffix = 'Société Ferid Khemakhem';
    const fullTitle = input.title.includes(suffix) ? input.title : `${input.title} | ${suffix}`;
    const path = input.path.replace(/^\/+|\/+$/g, '');
    const locale = this.locales.locale();
    const canonical = this.absolute(locale, path);
    const image = this.config.origin + (input.image ?? this.config.defaultOgImage);

    this.title.setTitle(fullTitle);

    this.setName('description', input.description);
    this.setName('robots', input.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

    this.setProperty('og:type', input.type ?? 'website');
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', input.description);
    this.setProperty('og:url', canonical);
    this.setProperty('og:image', image);
    this.setProperty('og:site_name', suffix);
    this.setProperty('og:locale', locale === 'fr' ? 'fr_TN' : 'en_US');
    this.setProperty('og:locale:alternate', locale === 'fr' ? 'en_US' : 'fr_TN');

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', fullTitle);
    this.setName('twitter:description', input.description);
    this.setName('twitter:image', image);

    this.setCanonical(canonical);
    this.setHreflang(path);
  }

  private absolute(locale: Locale, path: string): string {
    return `${this.config.origin}/${locale}${path ? `/${path}` : ''}`;
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private setCanonical(href: string): void {
    this.upsertLink("link[rel='canonical']", { rel: 'canonical', href });
  }

  /**
   * Emits one hreflang per locale plus x-default. x-default points at French:
   * it is the language the business operates in and the legacy site's only
   * real language.
   */
  private setHreflang(path: string): void {
    const head = this.document.head;
    head
      .querySelectorAll("link[rel='alternate'][hreflang]")
      .forEach((node) => node.remove());

    const entries: readonly (readonly [string, string])[] = [
      ['fr', this.absolute('fr', path)],
      ['en', this.absolute('en', path)],
      ['x-default', this.absolute('fr', path)],
    ];

    for (const [hreflang, href] of entries) {
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      link.setAttribute('href', href);
      head.appendChild(link);
    }
  }

  private upsertLink(selector: string, attrs: Record<string, string>): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = this.document.createElement('link');
      this.document.head.appendChild(link);
    }
    for (const [key, value] of Object.entries(attrs)) {
      link.setAttribute(key, value);
    }
  }
}
