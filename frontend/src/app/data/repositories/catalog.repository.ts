import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Brand,
  Category,
  CategoryId,
  FacetSet,
  Industry,
  Paginated,
  Product,
  ProductQuery,
} from '../../shared/models/catalog.model';

/** Catalogue sizes for counters: in total, per division and per brand. */
export interface CatalogStats {
  readonly total: number;
  readonly categories: Readonly<Partial<Record<CategoryId, number>>>;
  readonly brands: Readonly<Record<string, number>>;
}

/**
 * The seam between the application and its content source.
 *
 * The catalogue lives in the database: every method is one bounded request —
 * one page (at most 12 products), one product, a handful of related or
 * featured products, or aggregate counts. There is deliberately no way to ask
 * for the whole catalogue; nothing in the storefront needs it in memory.
 *
 * Observables (rather than signals) are used here deliberately: this is an I/O
 * boundary. Consumers convert to signals with `toSignal` at the point of use.
 */
export interface ProductRepository {
  /** One page, filtered, searched and sorted by the server. `page` is 1-based. */
  list(query: ProductQuery): Observable<Paginated<Product>>;
  /** A product page: the product only if it belongs to the division in the URL. */
  bySlug(categorySlug: string, slug: string): Observable<Product | null>;
  /** A product by slug alone, for links that carry no division. */
  byProductSlug(slug: string): Observable<Product | null>;
  /** Curated products first, then verified ones; optionally within one division. */
  featured(limit: number, categoryId?: CategoryId): Observable<readonly Product[]>;
  /** Running and upcoming promotions. */
  offers(limit: number): Observable<readonly Product[]>;
  /** Neighbours of the product at `slug`, scored by the server; needs no prior lookup. */
  related(slug: string, limit?: number): Observable<readonly Product[]>;
  facets(query: ProductQuery): Observable<FacetSet>;
  /** Null while unknown (prerendering, or the API unreachable). */
  stats(): Observable<CatalogStats | null>;
}

export interface CategoryRepository {
  all(): Observable<readonly Category[]>;
  bySlug(slug: string): Observable<Category | null>;
}

export interface BrandRepository {
  all(): Observable<readonly Brand[]>;
  bySlug(slug: string): Observable<Brand | null>;
}

export interface IndustryRepository {
  all(): Observable<readonly Industry[]>;
  bySlug(slug: string): Observable<Industry | null>;
}

export const PRODUCT_REPOSITORY = new InjectionToken<ProductRepository>('PRODUCT_REPOSITORY');
export const CATEGORY_REPOSITORY = new InjectionToken<CategoryRepository>('CATEGORY_REPOSITORY');
export const BRAND_REPOSITORY = new InjectionToken<BrandRepository>('BRAND_REPOSITORY');
export const INDUSTRY_REPOSITORY = new InjectionToken<IndustryRepository>('INDUSTRY_REPOSITORY');
