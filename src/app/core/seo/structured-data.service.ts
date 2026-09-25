import { DOCUMENT, Injectable, inject } from '@angular/core';
import { SITE_CONFIG } from '../config/site.config';
import { LocaleService } from '../i18n/locale.service';
import { COMPANY } from '../../data/company.data';
import { Product } from '../../shared/models/catalog.model';

type JsonLd = Record<string, unknown>;

const SCRIPT_ID = 'fk-structured-data';

/**
 * Emits JSON-LD into the document head.
 *
 * Deliberate omissions, per the brief's rule against fabricated data:
 *  - no `offers`/`price` on Product — the company publishes no prices;
 *  - no `openingHours` — not supplied;
 *  - no `geo` — no coordinates published;
 *  - no `aggregateRating` — no reviews exist.
 * Emitting an empty or invented value for any of these would be a false
 * statement to search engines, not just a UI placeholder.
 */
@Injectable({ providedIn: 'root' })
export class StructuredDataService {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(SITE_CONFIG);
  private readonly locales = inject(LocaleService);

  set(graph: readonly JsonLd[]): void {
    const existing = this.document.getElementById(SCRIPT_ID);
    existing?.remove();

    if (graph.length === 0) {
      return;
    }

    const script = this.document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    this.document.head.appendChild(script);
  }

  organization(): JsonLd {
    const address: JsonLd = {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.address.street,
      addressLocality: COMPANY.address.locality,
      postalCode: COMPANY.address.postalCode,
      addressCountry: COMPANY.address.countryCode,
    };

    return {
      '@type': 'Organization',
      '@id': `${this.config.origin}/#organization`,
      name: COMPANY.legalName,
      alternateName: COMPANY.tradingName,
      url: this.config.origin,
      logo: `${this.config.origin}/img/logo-transparent.png`,
      foundingDate: String(COMPANY.foundedYear),
      address,
      telephone: COMPANY.telephone,
      email: COMPANY.email,
      ...(COMPANY.fax ? { faxNumber: COMPANY.fax } : {}),
      ...(COMPANY.social.length ? { sameAs: COMPANY.social.map((s) => s.url) } : {}),
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'sales',
          telephone: COMPANY.telephone,
          email: COMPANY.email,
          areaServed: 'TN',
          availableLanguage: ['fr', 'en'],
        },
      ],
    };
  }

  /**
   * LocalBusiness is only emitted once coordinates are supplied. Publishing a
   * business location without `geo` invites search engines to guess, and a
   * wrong pin on a distributor's map is worse than no pin.
   */
  localBusiness(): JsonLd | null {
    if (!COMPANY.geo) {
      return null;
    }
    return {
      '@type': 'LocalBusiness',
      '@id': `${this.config.origin}/#localbusiness`,
      name: COMPANY.legalName,
      image: `${this.config.origin}/img/og/default.png`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: COMPANY.address.street,
        addressLocality: COMPANY.address.locality,
        postalCode: COMPANY.address.postalCode,
        addressCountry: COMPANY.address.countryCode,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: COMPANY.geo.lat,
        longitude: COMPANY.geo.lng,
      },
      telephone: COMPANY.telephone,
      url: this.config.origin,
    };
  }

  website(): JsonLd {
    return {
      '@type': 'WebSite',
      '@id': `${this.config.origin}/#website`,
      url: this.config.origin,
      name: COMPANY.legalName,
      inLanguage: this.locales.htmlLang(),
      publisher: { '@id': `${this.config.origin}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${this.config.origin}/${this.locales.locale()}/products?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  breadcrumbs(trail: readonly { name: string; path: string }[]): JsonLd {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${this.config.origin}${crumb.path}`,
      })),
    };
  }

  product(product: Product, path: string): JsonLd {
    const locale = this.locales.locale();
    const image = product.images[0];

    return {
      '@type': 'Product',
      '@id': `${this.config.origin}${path}#product`,
      name: product.name[locale],
      description: product.shortDescription[locale],
      sku: product.id,
      ...(image
        ? { image: image.src.startsWith('http') ? image.src : `${this.config.origin}${image.src}` }
        : {}),
      ...(product.brandId ? { brand: { '@type': 'Brand', name: product.brandId } } : {}),
      category: product.categoryId,
      // No `offers` — the company publishes no prices, and inventing one would
      // put a false price into search results.
      manufacturer: { '@id': `${this.config.origin}/#organization` },
    };
  }
}
