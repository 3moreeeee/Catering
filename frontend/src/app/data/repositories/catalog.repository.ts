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

/**
 * The seam between the application and its content source.
 *
 * Nothing above this interface knows whether data comes from a bundled TypeScript
 * file, a REST endpoint, Strapi, Directus, Sanity or GraphQL. Swapping the whole
 * site onto a live CMS is a provider change in `app.config.ts` — no component,
 * store or route changes.
 *
 * Observables (rather than signals) are used here deliberately: this is an I/O
 * boundary, and a real implementation will be asynchronous. Consumers convert to
 * signals with `toSignal` at the point of use.
 */
export interface ProductRepository {
  list(query: ProductQuery): Observable<Paginated<Product>>;
  bySlug(categorySlug: string, slug: string): Observable<Product | null>;
  byId(id: string): Observable<Product | null>;
  featured(limit?: number): Observable<readonly Product[]>;
  related(product: Product, limit?: number): Observable<readonly Product[]>;
  facets(query: ProductQuery): Observable<FacetSet>;
  /** Every product, for search indexing and prerender param generation. */
  all(): Observable<readonly Product[]>;
  countByCategory(): Observable<Readonly<Record<CategoryId, number>>>;
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
