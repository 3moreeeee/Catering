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
      queueMicrotask(() => this.applySeo());
    });
  }

  private applySeo(): void {
    const category = this.category();
    const path = category ? `products/${category.slug}` : 'products';

    this.seo.apply({
      title: category
        ? this.locales.text(category.seo.title)
        : this.transloco.translate('catalog.title'),
      description: category
        ? this.locales.text(category.seo.description)
        : this.transloco.translate('meta.defaultDescription'),
      path,
      // Filtered views are canonicalised to the unfiltered list to avoid
      // flooding the index with near-duplicate facet permutations.
      noIndex: this.store.hasActiveFilters(),
    });

    this.jsonLd.set([this.jsonLd.organization(), this.jsonLd.breadcrumbs(this.breadcrumbTrail())]);
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
