import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  CategoryId,
  FacetSet,
  FacetValue,
  Paginated,
  Product,
  ProductQuery,
} from '../../shared/models/catalog.model';
import { PRODUCTS } from '../products.data';
import { CATEGORIES } from '../categories.data';
import { facetLabel, FacetKind } from '../catalog-labels';
import { normalize } from './in-memory.repository';

/**
 * The static catalogue snapshot as a queryable repository — for the data
 * integrity specs and tooling only. The storefront never imports this file:
 * its catalogue is the database, through ApiProductRepository.
 */
export const DEFAULT_PAGE_SIZE = 24;
export const CATALOG_PRODUCTS = new InjectionToken<readonly Product[]>('CATALOG_PRODUCTS', {
  providedIn: 'root',
  factory: () => PRODUCTS,
});

/** Builds the haystack a product is searched against. Computed once per product. */
function searchIndexOf(product: Product): string {
  return normalize(
    [
      product.name.en,
      product.name.fr,
      product.shortDescription.en,
      product.shortDescription.fr,
      product.categoryId,
      product.subcategoryId ?? '',
      product.brandId ?? '',
      ...product.formats.map((f) => f.value),
    ].join(' '),
  );
}

@Injectable({ providedIn: 'root' })
export class InMemoryProductRepository {
  private readonly index: Map<string, string>;

  // Specs and tooling construct this directly with an explicit product list,
  // outside any injection context, so inject() cannot replace the parameter.
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(@Inject(CATALOG_PRODUCTS) private readonly products: readonly Product[] = PRODUCTS) {
    this.index = new Map(products.map((p) => [p.id, searchIndexOf(p)]));
  }

  all(): Observable<readonly Product[]> {
    return of(this.products);
  }

  list(query: ProductQuery): Observable<Paginated<Product>> {
    const filtered = this.applySort(this.applyFilters(query), query);
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
    const start = (page - 1) * pageSize;

    return of({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages,
    });
  }

  bySlug(categorySlug: string, slug: string): Observable<Product | null> {
    const category = CATEGORIES.find((c) => c.slug === categorySlug);
    if (!category) {
      return of(null);
    }
    return of(
      this.products.find(
        (p) =>
          p.categoryId === category.id &&
          (p.slug === slug || p.colorVariants?.some((variant) => variant.slug === slug)),
      ) ?? null,
    );
  }

  byId(id: string): Observable<Product | null> {
    return of(this.products.find((p) => p.id === id) ?? null);
  }

  featured(limit = 12): Observable<readonly Product[]> {
    return of(this.products.filter((p) => p.featured).slice(0, limit));
  }

  /**
   * Relatedness is scored rather than filtered, so a product always has
   * neighbours to show even when its subcategory holds only one item.
   */
  related(product: Product, limit = 4): Observable<readonly Product[]> {
    const scored = this.products
      .filter((p) => p.id !== product.id)
      .map((p) => {
        let score = 0;
        if (p.subcategoryId && p.subcategoryId === product.subcategoryId) score += 5;
        if (p.categoryId === product.categoryId) score += 2;
        if (p.brandId && p.brandId === product.brandId) score += 3;
        score += p.industries.filter((i) => product.industries.includes(i)).length;
        return { product: p, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return of(scored.slice(0, limit).map((entry) => entry.product));
  }

  countByCategory(): Observable<Readonly<Record<CategoryId, number>>> {
    const counts: Record<CategoryId, number> = { food: 0, monin: 0, packaging: 0, hygiene: 0 };
    for (const product of this.products) {
      counts[product.categoryId] += 1;
    }
    return of(counts);
  }

  /**
   * Facet counts are computed against the query with that facet's own filter
   * removed, so selecting "Gloves" does not zero out every other subcategory —
   * the standard faceted-search behaviour buyers expect.
   */
  facets(query: ProductQuery): Observable<FacetSet> {
    // Each facet is counted against the query with its OWN filter removed, so
    // selecting "Gloves" does not zero out every other subcategory.
    const omit = (key: keyof ProductQuery): readonly Product[] => {
      const reduced: Record<string, unknown> = { ...query };
      delete reduced[key];
      return this.applyFilters(reduced);
    };

    return of({
      categories: this.countFacet(omit('categories'), (p) => [p.categoryId], 'categories'),
      subcategories: this.countFacet(
        omit('subcategories'),
        (p) => (p.subcategoryId ? [p.subcategoryId] : []),
        'subcategories',
      ),
      brands: this.countFacet(omit('brands'), (p) => (p.brandId ? [p.brandId] : []), 'brands'),
      industries: this.countFacet(omit('industries'), (p) => p.industries, 'industries'),
      sizes: this.countFacet(
        omit('sizes'),
        (p) => p.formats.flatMap((f) => (f.sizeBucket ? [f.sizeBucket] : [])),
        'sizes',
      ),
    });
  }

  // ---------------------------------------------------------------------------

  private applyFilters(query: ProductQuery): readonly Product[] {
    const terms = query.q ? normalize(query.q).split(/\s+/).filter(Boolean) : [];

    return this.products.filter((product) => {
      if (terms.length > 0) {
        const haystack = this.index.get(product.id) ?? '';
        if (!terms.every((term) => haystack.includes(term))) {
          return false;
        }
      }
      if (query.categories?.length && !query.categories.includes(product.categoryId)) {
        return false;
      }
      if (
        query.subcategories?.length &&
        (!product.subcategoryId || !query.subcategories.includes(product.subcategoryId))
      ) {
        return false;
      }
      if (query.brands?.length && (!product.brandId || !query.brands.includes(product.brandId))) {
        return false;
      }
      if (
        query.industries?.length &&
        !product.industries.some((i) => query.industries?.includes(i))
      ) {
        return false;
      }
      if (
        query.sizes?.length &&
        !product.formats.some((f) => f.sizeBucket && query.sizes?.includes(f.sizeBucket))
      ) {
        return false;
      }
      return true;
    });
  }

  private applySort(products: readonly Product[], query: ProductQuery): readonly Product[] {
    const sorted = [...products];
    switch (query.sort) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.en.localeCompare(a.name.en, 'en'));
      case 'category':
        return sorted.sort(
          (a, b) =>
            a.categoryId.localeCompare(b.categoryId) ||
            (a.subcategoryId ?? '').localeCompare(b.subcategoryId ?? '') ||
            a.name.en.localeCompare(b.name.en, 'en'),
        );
      case 'relevance':
      default:
        // Without a search term, "relevance" means featured first — otherwise
        // the catalogue opens on whatever happened to be first in the source.
        return query.q ? sorted : sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
  }

  private countFacet(
    products: readonly Product[],
    extract: (product: Product) => readonly string[],
    kind: FacetKind,
  ): readonly FacetValue[] {
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const value of extract(product)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: facetLabel(kind, id), count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }
}
