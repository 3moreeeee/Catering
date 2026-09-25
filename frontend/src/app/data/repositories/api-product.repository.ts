import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import {
  EMPTY,
  Observable,
  catchError,
  concat,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { IDENTITY_API_URL } from '../../core/auth/identity-api.token';
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
import { PRODUCTS } from '../products.data';
import { ProductRepository } from './catalog.repository';
import { InMemoryProductRepository } from './in-memory.repository';

interface ApiPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface ApiProduct {
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
}

/** Live Neon-backed catalogue with the bundled snapshot as an offline/SSR fallback. */
@Injectable({ providedIn: 'root' })
export class ApiProductRepository implements ProductRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly prerendering = isPlatformServer(inject(PLATFORM_ID)) && inject(REQUEST) === null;

  private readonly bundled = PRODUCTS.map(withHostedImages);

  /**
   * The bundled snapshot first, synchronously, then the live catalogue once the
   * API answers. The synchronous first value is what the prerendered HTML was
   * built from, so the browser's first render matches it and hydration has
   * nothing to reconcile; the API value then replaces it. If the API fails the
   * snapshot simply stays.
   */
  private readonly catalogue$ = this.prerendering
    ? of(this.bundled)
    : concat(
        of(this.bundled),
        this.http
          .get<ApiPage<ApiProduct>>(`${this.apiUrl}/products`, {
            params: { page: 0, pageSize: 100 },
          })
          .pipe(
            switchMap((first) => {
              if (first.totalPages <= 1) return of(first.items);
              const remaining = Array.from({ length: first.totalPages - 1 }, (_, index) =>
                this.http.get<ApiPage<ApiProduct>>(`${this.apiUrl}/products`, {
                  params: { page: index + 1, pageSize: 100 },
                }),
              );
              return forkJoin(remaining).pipe(
                map((pages) => [first.items, ...pages.map((page) => page.items)].flat()),
              );
            }),
            map((products) => products.map(toProduct)),
            catchError(() => EMPTY),
          ),
      ).pipe(shareReplay({ bufferSize: 1, refCount: false }));

  all(): Observable<readonly Product[]> {
    return this.catalogue$;
  }

  list(query: ProductQuery): Observable<Paginated<Product>> {
    return this.withCatalogue((repository) => repository.list(query));
  }

  bySlug(categorySlug: string, slug: string): Observable<Product | null> {
    return this.withCatalogue((repository) => repository.bySlug(categorySlug, slug));
  }

  byId(id: string): Observable<Product | null> {
    return this.withCatalogue((repository) => repository.byId(id));
  }

  featured(limit = 12): Observable<readonly Product[]> {
    return this.withCatalogue((repository) => repository.featured(limit));
  }

  related(product: Product, limit = 4): Observable<readonly Product[]> {
    return this.withCatalogue((repository) => repository.related(product, limit));
  }

  facets(query: ProductQuery): Observable<FacetSet> {
    return this.withCatalogue((repository) => repository.facets(query));
  }

  countByCategory(): Observable<Readonly<Record<CategoryId, number>>> {
    return this.withCatalogue((repository) => repository.countByCategory());
  }

  private withCatalogue<T>(
    operation: (repository: InMemoryProductRepository) => Observable<T>,
  ): Observable<T> {
    return this.catalogue$.pipe(
      switchMap((products) => operation(new InMemoryProductRepository(products))),
    );
  }
}

function withHostedImages(product: Product): Product {
  return {
    ...product,
    images: product.images.map((image) => ({ ...image, src: imageKitMediaUrl(image.src) })),
  };
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
    images: value.images.map((image) => ({
      src: image.src,
      alt: {
        fr: image.alt?.fr || name.fr,
        en: image.alt?.en || image.alt?.fr || name.en,
      },
      width: image.width || 800,
      height: image.height || 800,
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
      ...(value.images[0]?.src ? { ogImage: value.images[0].src } : {}),
    },
    needsVerification: value.needsVerification,
  };
}
