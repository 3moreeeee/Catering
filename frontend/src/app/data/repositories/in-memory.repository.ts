import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  Brand,
  Category,
  CategoryId,
  FacetSet,
  FacetValue,
  Industry,
  Paginated,
  Product,
  ProductQuery,
  SIZE_BUCKETS,
} from '../../shared/models/catalog.model';
import { LocalizedText } from '../../shared/models/localized-text.model';
import { PRODUCTS } from '../products.data';
import { CATEGORIES } from '../categories.data';
import { BRANDS } from '../brands.data';
import { INDUSTRIES } from '../industries.data';
import {
  BrandRepository,
  CategoryRepository,
  IndustryRepository,
  ProductRepository,
} from './catalog.repository';

export const DEFAULT_PAGE_SIZE = 24;
export const CATALOG_PRODUCTS = new InjectionToken<readonly Product[]>('CATALOG_PRODUCTS', {
  providedIn: 'root',
  factory: () => PRODUCTS,
});

/** Accent- and case-insensitive normalisation, so "cafe" matches "café". */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

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
export class InMemoryProductRepository implements ProductRepository {
  private readonly index: Map<string, string>;

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
    return of(this.products.find((p) => p.slug === slug && p.categoryId === category.id) ?? null);
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
      return this.applyFilters(reduced as ProductQuery);
    };

    return of({
      categories: this.countFacet(
        omit('categories'),
        (p) => [p.categoryId],
        (id) => this.categoryLabel(id),
      ),
      subcategories: this.countFacet(
        omit('subcategories'),
        (p) => (p.subcategoryId ? [p.subcategoryId] : []),
        (id) => this.subcategoryLabel(id),
      ),
      brands: this.countFacet(
        omit('brands'),
        (p) => (p.brandId ? [p.brandId] : []),
        (id) => {
          const name = BRANDS.find((b) => b.id === id)?.name ?? id;
          return { en: name, fr: name };
        },
      ),
      industries: this.countFacet(
        omit('industries'),
        (p) => p.industries,
        (id) => {
          const industry = INDUSTRIES.find((i) => i.id === id);
          return industry?.name ?? { en: id, fr: id };
        },
      ),
      sizes: this.countFacet(
        omit('sizes'),
        (p) => p.formats.flatMap((f) => (f.sizeBucket ? [f.sizeBucket] : [])),
        (id) => SIZE_LABELS[id] ?? { en: id, fr: id },
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
    label: (id: string) => LocalizedText,
  ): readonly FacetValue[] {
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const value of extract(product)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: label(id), count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }

  private categoryLabel(id: string): LocalizedText {
    return CATEGORIES.find((c) => c.id === id)?.name ?? { en: id, fr: id };
  }

  private subcategoryLabel(id: string): LocalizedText {
    for (const category of CATEGORIES) {
      const sub = category.subcategories.find((s) => s.id === id);
      if (sub) {
        return sub.name;
      }
    }
    return { en: id, fr: id };
  }
}

const SIZE_LABELS: Record<string, LocalizedText> = {
  single: { en: 'Single portion (≤ 100 ml/g)', fr: 'Monoportion (≤ 100 ml/g)' },
  small: { en: 'Small (100–500 ml/g)', fr: 'Petit (100–500 ml/g)' },
  medium: { en: 'Medium (500 ml – 1.2 L)', fr: 'Moyen (500 ml – 1,2 L)' },
  large: { en: 'Large (1.2–4 L/kg)', fr: 'Grand (1,2–4 L/kg)' },
  bulk: { en: 'Bulk (> 4 L/kg)', fr: 'Vrac (> 4 L/kg)' },
};

/** Exposed for the filter UI so it can render buckets with zero results as disabled. */
export const ALL_SIZE_BUCKETS = SIZE_BUCKETS;

@Injectable({ providedIn: 'root' })
export class InMemoryCategoryRepository implements CategoryRepository {
  all(): Observable<readonly Category[]> {
    return of(CATEGORIES);
  }
  bySlug(slug: string): Observable<Category | null> {
    return of(CATEGORIES.find((c) => c.slug === slug) ?? null);
  }
}

@Injectable({ providedIn: 'root' })
export class InMemoryBrandRepository implements BrandRepository {
  all(): Observable<readonly Brand[]> {
    return of(BRANDS);
  }
  bySlug(slug: string): Observable<Brand | null> {
    return of(BRANDS.find((b) => b.slug === slug) ?? null);
  }
}

@Injectable({ providedIn: 'root' })
export class InMemoryIndustryRepository implements IndustryRepository {
  all(): Observable<readonly Industry[]> {
    return of(INDUSTRIES);
  }
  bySlug(slug: string): Observable<Industry | null> {
    return of(INDUSTRIES.find((i) => i.slug === slug) ?? null);
  }
}
