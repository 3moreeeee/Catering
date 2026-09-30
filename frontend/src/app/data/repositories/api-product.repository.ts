import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, catchError, map, of } from 'rxjs';
import { IDENTITY_API_URL } from '../../core/auth/identity-api.token';
import { retryWhileWaking } from '../../core/http/retry-while-waking';
import { imageKitMediaUrl } from '../../core/config/imagekit.generated';
import {
  CategoryId,
  FacetSet,
  IndustryId,
  Paginated,
  Product,
  ProductQuery,
  SizeBucket,
} from '../../shared/models/catalog.model';
import { CATEGORIES } from '../categories.data';
import { labelled } from '../catalog-labels';
import { CatalogStats, ProductRepository } from './catalog.repository';
import { PricingService } from '../../core/cart/pricing.service';
import { ProductPricePoint } from '../../core/cart/cart.models';

/** The server's page ceiling; asking for more is pointless, it answers with 12. */
export const CATALOG_PAGE_SIZE = 12;

interface ApiPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  /** Zero-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface ApiFacetValue {
  readonly id: string;
  readonly count: number;
}

interface ApiFacets {
  readonly categories: readonly ApiFacetValue[];
  readonly subcategories: readonly ApiFacetValue[];
  readonly brands: readonly ApiFacetValue[];
  readonly industries: readonly ApiFacetValue[];
  readonly sizes: readonly ApiFacetValue[];
}

interface ApiProduct {
  readonly id: string;
  readonly sourceId: string;
  readonly slug: string;
  readonly name: { readonly fr: string; readonly en: string | null };
  readonly shortDescription: { readonly fr: string | null; readonly en: string | null } | null;
  readonly description: { readonly fr: string | null; readonly en: string | null } | null;
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly brandId: string | null;
  readonly industries: readonly string[];
  readonly formats: readonly {
    readonly id: string | null;
    readonly value: string;
    readonly packQuantity: number | null;
    readonly sizeBucket: string | null;
    readonly reference: string | null;
  }[];
  readonly images: readonly {
    readonly src: string;
    readonly alt: { readonly fr: string | null; readonly en: string | null } | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly metrics?: {
      readonly occupancy: number;
      readonly width: number;
      readonly bottom: number;
      readonly reliable: boolean;
    } | null;
  }[];
  readonly colorVariants?: readonly {
    readonly id: string;
    readonly slug: string;
    readonly label: { readonly fr: string; readonly en: string | null };
    readonly swatch: string;
  }[];
  readonly featured: boolean;
  readonly price: number | null;
  readonly currency: string | null;
  readonly offerPrice: number | null;
  readonly offerStartsAt: string | null;
  readonly offerEndsAt: string | null;
  readonly offerActive: boolean;
  readonly offerCurrentlyActive: boolean;
  readonly technicalSheetUrl: string | null;
  readonly seoTitle: { readonly fr: string | null; readonly en: string | null } | null;
  readonly seoDescription: { readonly fr: string | null; readonly en: string | null } | null;
  readonly needsVerification: boolean;
  readonly active: boolean;
  readonly stockQuantity: number | null;
  readonly saleMode: 'UNIT' | 'PACK_ONLY' | null;
  readonly unitPrice: number | null;
  readonly packQuantity: number | null;
  readonly unitLabel: string | null;
}

interface ApiStats {
  readonly total: number;
  readonly categories: Readonly<Record<string, number>>;
  readonly brands: Readonly<Record<string, number>>;
}

const EMPTY_FACETS: FacetSet = {
  categories: [],
  subcategories: [],
  brands: [],
  industries: [],
  sizes: [],
};

/**
 * The catalogue, read from the Spring Boot API (Neon) one bounded request at a
 * time. Server-side rendering performs these requests and Angular's HTTP
 * transfer cache hands the responses to the hydrating browser, so a page's
 * data is fetched once.
 *
 * During build-time prerendering there is no request and no API to call; the
 * pages prerendered then (about, contact, legal) show no catalogue data and
 * load their counters in the browser.
 */
@Injectable({ providedIn: 'root' })
export class ApiProductRepository implements ProductRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly prerendering = isPlatformServer(inject(PLATFORM_ID)) && inject(REQUEST) === null;
  private readonly pricing = inject(PricingService);

  /** Maps API products and hands their price terms to the pricing cache. */
  private toProducts(items: readonly ApiProduct[]): Product[] {
    this.pricing.seed(items.map(toPricePoint));
    return items.map(toProduct);
  }

  list(query: ProductQuery): Observable<Paginated<Product>> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const empty: Paginated<Product> = {
      items: [],
      total: 0,
      page,
      pageSize: CATALOG_PAGE_SIZE,
      totalPages: 1,
    };
    if (this.prerendering) return of(empty);
    const params = filterParams(query)
      .set('page', String(page - 1))
      .set('pageSize', String(CATALOG_PAGE_SIZE))
      .set('sort', query.sort ?? 'relevance');
    return this.get<ApiPage<ApiProduct>>('/products', params).pipe(
      map((result) => ({
        items: this.toProducts(result.items),
        total: result.total,
        page: result.page + 1,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })),
      catchError(() => of(empty)),
    );
  }

  bySlug(categorySlug: string, slug: string): Observable<Product | null> {
    const category = CATEGORIES.find((c) => c.slug === categorySlug);
    if (!category) return of(null);
    return this.byProductSlug(slug).pipe(
      map((product) => (product?.categoryId === category.id ? product : null)),
    );
  }

  byProductSlug(slug: string): Observable<Product | null> {
    if (this.prerendering || !slug) return of(null);
    return this.get<ApiProduct>(`/products/${encodeURIComponent(slug)}`).pipe(
      map((product) => this.toProducts([product])[0]!),
      catchError(() => of(null)),
    );
  }

  featured(limit: number, categoryId?: CategoryId): Observable<readonly Product[]> {
    if (this.prerendering) return of([]);
    let params = new HttpParams().set('limit', String(limit));
    if (categoryId) params = params.set('category', categoryId);
    return this.products('/products/featured', params);
  }

  offers(limit: number): Observable<readonly Product[]> {
    if (this.prerendering) return of([]);
    return this.products('/products/offers', new HttpParams().set('limit', String(limit)));
  }

  related(slug: string, limit = 4): Observable<readonly Product[]> {
    if (this.prerendering || !slug) return of([]);
    return this.products(
      `/products/${encodeURIComponent(slug)}/related`,
      new HttpParams().set('limit', String(limit)),
    );
  }

  facets(query: ProductQuery): Observable<FacetSet> {
    if (this.prerendering) return of(EMPTY_FACETS);
    return this.get<ApiFacets>('/products/facets', filterParams(query)).pipe(
      map((facets) => ({
        categories: labelled('categories', facets.categories),
        subcategories: labelled('subcategories', facets.subcategories),
        brands: labelled('brands', facets.brands),
        industries: labelled('industries', facets.industries),
        sizes: labelled('sizes', facets.sizes),
      })),
      catchError(() => of(EMPTY_FACETS)),
    );
  }

  stats(): Observable<CatalogStats | null> {
    if (this.prerendering) return of(null);
    return this.get<ApiStats>('/products/stats').pipe(
      map((stats) => ({ total: stats.total, categories: stats.categories, brands: stats.brands })),
      catchError(() => of(null)),
    );
  }

  private products(path: string, params: HttpParams): Observable<readonly Product[]> {
    return this.get<readonly ApiProduct[]>(path, params).pipe(
      map((items) => this.toProducts(items)),
      catchError(() => of([])),
    );
  }

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${this.apiUrl}${path}`, params ? { params } : {})
      .pipe(retryWhileWaking());
  }
}

/** The price terms of a catalogue product, as the /prices endpoint would report them. */
function toPricePoint(value: ApiProduct): ProductPricePoint {
  return {
    sourceId: value.sourceId,
    id: value.id,
    slug: value.slug,
    price: value.offerCurrentlyActive && value.offerPrice !== null ? value.offerPrice : value.price,
    originalPrice: value.price,
    offerActive: value.offerCurrentlyActive,
    currency: value.currency,
    stockQuantity: value.stockQuantity,
    active: value.active,
    saleMode: value.saleMode ?? 'UNIT',
    unitPrice: value.unitPrice,
    packQuantity: value.packQuantity,
    unitLabel: value.unitLabel,
  };
}

/** The filters of a query as API parameters; multi-valued ones comma-separated. */
function filterParams(query: ProductQuery): HttpParams {
  let params = new HttpParams();
  const q = query.q?.trim();
  if (q) params = params.set('q', q);
  const lists: [string, readonly string[] | undefined][] = [
    ['category', query.categories],
    ['subcategory', query.subcategories],
    ['brand', query.brands],
    ['industry', query.industries],
    ['size', query.sizes],
  ];
  for (const [name, values] of lists) {
    if (values?.length) params = params.set(name, values.join(','));
  }
  return params;
}

function toProduct(value: ApiProduct): Product {
  const name = { fr: value.name.fr, en: value.name.en || value.name.fr };
  return {
    id: value.sourceId,
    slug: value.slug,
    name,
    shortDescription: {
      fr: value.shortDescription?.fr || '',
      en: value.shortDescription?.en || value.shortDescription?.fr || '',
    },
    description: {
      fr: value.description?.fr || '',
      en: value.description?.en || value.description?.fr || '',
    },
    categoryId: value.categoryId as CategoryId,
    ...(value.subcategoryId ? { subcategoryId: value.subcategoryId } : {}),
    ...(value.brandId ? { brandId: value.brandId } : {}),
    industries: value.industries as readonly IndustryId[],
    formats: value.formats.map((format) => ({
      id: format.id || `${value.sourceId}-${format.value}`,
      value: format.value,
      ...(format.packQuantity != null ? { packQuantity: format.packQuantity } : {}),
      ...(format.sizeBucket ? { sizeBucket: format.sizeBucket as SizeBucket } : {}),
      ...(format.reference ? { reference: format.reference } : {}),
    })),
    ...(value.colorVariants?.length
      ? {
          colorVariants: value.colorVariants.map((variant) => ({
            id: variant.id,
            slug: variant.slug,
            label: { fr: variant.label.fr, en: variant.label.en || variant.label.fr },
            swatch: variant.swatch,
          })),
        }
      : {}),
    images: value.images.map((image) => ({
      // A catalogue path ("/img/products/…") is served from ImageKit; an
      // absolute URL is left exactly as stored.
      src: imageKitMediaUrl(image.src),
      alt: {
        fr: image.alt?.fr || name.fr,
        en: image.alt?.en || image.alt?.fr || name.en,
      },
      width: image.width || 800,
      height: image.height || 800,
      ...(image.metrics ? { metrics: image.metrics } : {}),
    })),
    featured: value.featured,
    ...(value.offerActive &&
    value.price !== null &&
    value.offerPrice !== null &&
    value.offerPrice < value.price
      ? {
          offer: {
            price: value.offerPrice,
            originalPrice: value.price,
            currency: value.currency || 'TND',
            ...(value.offerStartsAt ? { startsAt: value.offerStartsAt } : {}),
            ...(value.offerEndsAt ? { endsAt: value.offerEndsAt } : {}),
            currentlyActive: value.offerCurrentlyActive,
          },
        }
      : {}),
    ...(value.technicalSheetUrl ? { technicalSheetUrl: value.technicalSheetUrl } : {}),
    seo: {
      title: {
        fr: value.seoTitle?.fr || name.fr,
        en: value.seoTitle?.en || value.seoTitle?.fr || name.en,
      },
      description: {
        fr: value.seoDescription?.fr || value.shortDescription?.fr || '',
        en:
          value.seoDescription?.en || value.seoDescription?.fr || value.shortDescription?.en || '',
      },
      ...(value.images[0]?.src ? { ogImage: imageKitMediaUrl(value.images[0].src) } : {}),
    },
    needsVerification: value.needsVerification,
  };
}
