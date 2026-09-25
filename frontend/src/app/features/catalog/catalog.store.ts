import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, switchMap } from 'rxjs';
import {
  CategoryId,
  FacetSet,
  FacetValue,
  IndustryId,
  Paginated,
  Product,
  ProductQuery,
  SORT_OPTIONS,
  SizeBucket,
  SortOption,
  ViewMode,
} from '../../shared/models/catalog.model';
import { PRODUCT_REPOSITORY } from '../../data/repositories/catalog.repository';
import { LocaleService } from '../../core/i18n/locale.service';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { CATEGORIES } from '../../data/categories.data';
import { DEFAULT_PAGE_SIZE } from '../../data/repositories/in-memory.repository';

const CSV = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

/**
 * Catalogue state.
 *
 * Filters live in the URL, not in the component. Consequences that matter:
 *  - every filter combination is shareable and bookmarkable;
 *  - the server can render the filtered result set, so it is indexable;
 *  - browser back/forward steps through filter changes as users expect.
 *
 * The store is therefore a projection of the query string, not a parallel copy
 * of it — there is exactly one source of truth.
 */
@Injectable()
export class CatalogStore {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repo = inject(PRODUCT_REPOSITORY);
  private readonly locales = inject(LocaleService);
  private readonly links = inject(LocalizedRouter);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** A `/products/:category` route pre-selects that division. */
  private readonly routeCategory = toSignal(
    this.route.paramMap.pipe(
      map((p) => {
        const slug = p.get('category');
        return CATEGORIES.find((c) => c.slug === slug)?.id ?? null;
      }),
    ),
    { initialValue: null },
  );

  readonly view = signal<ViewMode>('grid');

  readonly query = computed<ProductQuery>(() => {
    const params = this.params();
    const routeCategory = this.routeCategory();
    const sortParam = params.get('sort');
    const sort: SortOption = SORT_OPTIONS.includes(sortParam as SortOption)
      ? (sortParam as SortOption)
      : 'relevance';

    const q = params.get('q');

    return {
      ...(q ? { q } : {}),
      categories: routeCategory ? [routeCategory] : (CSV(params.get('category')) as CategoryId[]),
      subcategories: CSV(params.get('sub')),
      brands: CSV(params.get('brand')),
      industries: CSV(params.get('industry')) as IndustryId[],
      sizes: CSV(params.get('size')) as SizeBucket[],
      sort,
      page: Number(params.get('page') ?? 1) || 1,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  });

  // The repository answers synchronously with the bundled catalogue and later
  // with the live one from the API. Reading only the synchronous value — as
  // this store used to — froze the page on whatever was there at first read:
  // with the API catalogue arriving over HTTP, that was an empty page, and the
  // catalogue showed "0 produits". So the store follows the stream, and falls
  // back to the synchronous read only until the stream's first value, which is
  // what server rendering and the hydrating first render see.
  private readonly liveResult = toSignal(
    toObservable(this.query).pipe(switchMap((query) => this.repo.list(query))),
  );
  private readonly result = computed<Paginated<Product>>(
    () => this.liveResult() ?? firstSync(this.repo.list(this.query()), this.emptyPage()),
  );

  private readonly liveFacets = toSignal(
    toObservable(this.query).pipe(switchMap((query) => this.repo.facets(query))),
  );
  private readonly facetSet = computed<FacetSet>(
    () => this.liveFacets() ?? firstSync(this.repo.facets(this.query()), this.emptyFacets()),
  );

  readonly products = computed(() => this.result().items);
  readonly total = computed(() => this.result().total);
  readonly page = computed(() => this.result().page);
  readonly totalPages = computed(() => this.result().totalPages);
  readonly facets = computed(() => this.facetSet());

  readonly isEmpty = computed(() => this.total() === 0);

  readonly hasActiveFilters = computed(() => {
    const q = this.query();
    return Boolean(
      q.q ||
      q.subcategories?.length ||
      q.brands?.length ||
      q.industries?.length ||
      q.sizes?.length ||
      (!this.routeCategory() && q.categories?.length),
    );
  });

  /** Active filters as removable chips. */
  readonly activeChips = computed(() => {
    const q = this.query();
    const facets = this.facets();
    const chips: { key: string; id: string; label: string }[] = [];

    if (q.q) {
      chips.push({ key: 'q', id: q.q, label: `“${q.q}”` });
    }
    const groups: [string, readonly string[] | undefined, readonly FacetValue[]][] = [
      ['category', this.routeCategory() ? [] : q.categories, facets.categories],
      ['sub', q.subcategories, facets.subcategories],
      ['brand', q.brands, facets.brands],
      ['industry', q.industries, facets.industries],
      ['size', q.sizes, facets.sizes],
    ];
    for (const [key, values, facet] of groups) {
      for (const id of values ?? []) {
        const label = facet.find((f) => f.id === id)?.label;
        chips.push({ key, id, label: label ? this.locales.text(label) : id });
      }
    }
    return chips;
  });

  // --- mutations (all go through the URL) ------------------------------------

  toggle(key: string, id: string): void {
    // A category in the path is the authoritative catalogue division. If the
    // user selects another category in the sidebar, change that path instead
    // of adding an ignored `?category=` parameter beside it.
    if (key === 'category' && this.routeCategory()) {
      this.switchRouteCategory(id as CategoryId);
      return;
    }

    const current = CSV(this.params().get(key));
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    this.patch({ [key]: next.length ? next.join(',') : null, page: null });
  }

  setSearch(value: string): void {
    this.patch({ q: value.trim() || null, page: null });
  }

  setSort(sort: SortOption): void {
    this.patch({ sort: sort === 'relevance' ? null : sort, page: null });
  }

  setPage(page: number): void {
    this.patch({ page: page > 1 ? String(page) : null });
  }

  removeChip(key: string, id: string): void {
    if (key === 'q') {
      this.patch({ q: null, page: null });
      return;
    }
    this.toggle(key, id);
  }

  clearAll(): void {
    this.patch({
      q: null,
      category: null,
      sub: null,
      brand: null,
      industry: null,
      size: null,
      page: null,
    });
  }

  private patch(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      // Filter changes should not each become a separate history entry to
      // back out of one at a time.
      replaceUrl: true,
    });
  }

  private switchRouteCategory(id: CategoryId): void {
    const current = this.routeCategory();
    const category = CATEGORIES.find((item) => item.id === id);
    if (!category) return;

    const path = current === id ? 'products' : `products/${category.slug}`;
    void this.router.navigate(this.links.path(path), {
      queryParams: {
        // Subcategories belong to a division, so carrying one across would
        // often create an apparently empty catalogue.
        category: null,
        sub: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private emptyPage(): Paginated<Product> {
    return { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 };
  }

  private emptyFacets(): FacetSet {
    return { categories: [], subcategories: [], brands: [], industries: [], sizes: [] };
  }
}

/** The value a source emits synchronously on subscription, or `fallback`. */
function firstSync<T>(source: Observable<T>, fallback: T): T {
  let value = fallback;
  source.subscribe((next) => (value = next)).unsubscribe();
  return value;
}
