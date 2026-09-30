import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from './catalog.store';
import { CatalogFilters } from './catalog-filters/catalog-filters';
import { ProductCard } from '../../shared/components/cards/product-card';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { SORT_OPTIONS, SortOption } from '../../shared/models/catalog.model';
import { CATEGORIES } from '../../data/categories.data';

/**
 * Catalogue listing.
 *
 * Server-rendered with real results so the 150 references are indexable —
 * nothing important is behind a client-only fetch. Filters are URL-bound
 * (see `CatalogStore`), so every result set is shareable.
 */
@Component({
  selector: 'fk-catalog-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogStore],
  imports: [RouterLink, TranslocoDirective, FormsModule, CatalogFilters, ProductCard],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
})
export class CatalogPage {
  readonly store = inject(CatalogStore);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);

  readonly sortOptions = SORT_OPTIONS;
  readonly filtersOpen = signal(false);
  searchTerm = '';

  /** The division being viewed, when the route is `/products/:category`. */
  readonly category = computed(() => {
    const ids = this.store.query().categories ?? [];
    return ids.length === 1 ? (CATEGORIES.find((c) => c.id === ids[0]) ?? null) : null;
  });

  readonly heading = computed(() => {
    const category = this.category();
    return category ? this.locales.text(category.name) : this.transloco.translate('catalog.title');
  });

  constructor() {
    effect(() => {
      // Track both route category and filter state. Angular reuses this page
      // component between `/products/food` and `/products/hygiene`, so SEO
      // metadata must be refreshed just like the visible catalogue content.
      this.category();
      this.store.hasActiveFilters();
      this.store.page();
      this.store.totalPages();
      this.store.products();
      queueMicrotask(() => this.applySeo());
    });
  }

  /**
   * Page numbers to link, with null for a gap: first, last, and two either side
   * of the current page, so every page is reachable in a few crawlable hops.
   */
  readonly pageLinks = computed<readonly (number | null)[]>(() => {
    const current = this.store.page();
    const last = this.store.totalPages();
    const wanted = new Set([1, last, current - 2, current - 1, current, current + 1, current + 2]);
    const pages = [...wanted].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
    const links: (number | null)[] = [];
    pages.forEach((page, index) => {
      if (index > 0 && page - pages[index - 1]! > 1) links.push(null);
      links.push(page);
    });
    return links;
  });

  /** Query parameters for a pagination link: the other filters are kept, page 1 has none. */
  pageParams(page: number): Record<string, string | null> {
    return { page: page > 1 ? String(page) : null };
  }

  private applySeo(): void {
    const category = this.category();
    const path = category ? `products/${category.slug}` : 'products';
    const page = this.store.page();
    const last = this.store.totalPages();
    const pageQuery = (n: number): string => (n > 1 ? `page=${n}` : '');
    const baseTitle = category
      ? this.locales.text(category.seo.title)
      : this.transloco.translate('catalog.title');
    const paginated = !this.store.hasActiveFilters();

    this.seo.apply({
      // Each page of the list is its own page: its own title and canonical.
      title:
        page > 1
          ? `${baseTitle} – ${this.transloco.translate('common.pageOf', { current: page, total: last })}`
          : baseTitle,
      description: category
        ? this.locales.text(category.seo.description)
        : this.transloco.translate('meta.defaultDescription'),
      path,
      query: pageQuery(page) || undefined,
      prev: paginated && page > 1 ? pageQuery(page - 1) : undefined,
      next: paginated && page < last ? pageQuery(page + 1) : undefined,
      // Filtered views stay out of the index to avoid flooding it with
      // near-duplicate facet permutations; so does a page past the end.
      noIndex: this.store.hasActiveFilters() || page > last,
    });

    this.jsonLd.set([
      this.jsonLd.organization(),
      this.jsonLd.breadcrumbs(this.breadcrumbTrail()),
      ...(this.store.products().length
        ? [this.jsonLd.itemList(this.store.products(), (product) => this.productPath(product))]
        : []),
    ]);
  }

  private productPath(product: { categoryId: string; slug: string }): string {
    const category = CATEGORIES.find((c) => c.id === product.categoryId);
    return this.links.url(`products/${category?.slug ?? product.categoryId}/${product.slug}`);
  }

  private breadcrumbTrail(): { name: string; path: string }[] {
    const trail = [
      { name: this.transloco.translate('nav.home'), path: this.links.url('') },
      { name: this.transloco.translate('catalog.title'), path: this.links.url('products') },
    ];
    const category = this.category();
    if (category) {
      trail.push({
        name: this.locales.text(category.name),
        path: this.links.url(`products/${category.slug}`),
      });
    }
    return trail;
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  onSort(value: string): void {
    this.store.setSort(value as SortOption);
  }

  submitSearch(): void {
    this.store.setSearch(this.searchTerm);
  }
}
