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
import { familyImage } from './family-images';
import { QuoteSection } from '../home/sections/quote-section';
import { ProductCard } from '../../shared/components/cards/product-card';
import { CatalogStats } from '../../core/catalog/catalog-stats.service';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import {
  ProductImage,
  SORT_OPTIONS,
  SortOption,
  Subcategory,
} from '../../shared/models/catalog.model';
import { LocalizedText } from '../../shared/models/localized-text.model';
import { uniformImageFit } from '../../shared/utils/product-image-fit';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { CATEGORIES, parentSubcategory } from '../../data/categories.data';

/** Products shown before the banner: two rows of four. */
const STORY_AFTER = 8;

/** One category of the shelf above the grid. */
interface FamilyChip {
  readonly id: string;
  readonly label: LocalizedText;
  /** Products in the category and its sub-categories, for the current filters. */
  readonly count: number;
  readonly photo: ProductImage | null;
}

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
  imports: [
    RouterLink,
    TranslocoDirective,
    FormsModule,
    CatalogFilters,
    ProductCard,
    LocalizedTextPipe,
    QuoteSection,
  ],
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
  readonly stats = inject(CatalogStats);
  readonly aisles = CATEGORIES;
  readonly heroScenes = ['all', ...CATEGORIES.map((category) => category.id)];
  readonly heroScene = computed(() => this.category()?.id ?? 'all');
  /**
   * The categories of the division on screen (all divisions on "All products"),
   * in the tree's order, each counted with its sub-categories. A category with
   * no product is left out until it receives one, unless it is the one being
   * browsed — a menu or shared link to it must not land on a missing shelf.
   */
  readonly families = computed<readonly FamilyChip[]>(() => {
    const counts = this.facetCounts();
    const scope = this.category() ? [this.category()!] : CATEGORIES;
    return scope
      .flatMap((division) => division.subcategories)
      .map((sub) => this.chip(sub, counts))
      .filter((chip) => chip.count > 0 || this.isFamilyActive(chip.id));
  });

  /** The second-level category being browsed, whether it or one of its sub-categories is selected. */
  readonly activeFamily = computed<Subcategory | null>(() => {
    const selected = this.store.query().subcategories ?? [];
    return selected.length === 1 ? parentSubcategory(selected[0]!) : null;
  });

  /** The third level of the category being browsed ("Gobelets en PET", "Gobelets en carton"…). */
  readonly subFamilies = computed<readonly FamilyChip[]>(() => {
    const counts = this.facetCounts();
    return (this.activeFamily()?.children ?? [])
      .map((sub) => this.chip(sub, counts))
      .filter((chip) => chip.count > 0 || this.isSubFamilyActive(chip.id));
  });

  private readonly facetCounts = computed(
    () => new Map(this.store.facets().subcategories.map((facet) => [facet.id, facet.count])),
  );

  private chip(sub: Subcategory, counts: ReadonlyMap<string, number>): FamilyChip {
    const children = sub.children ?? [];
    return {
      id: sub.id,
      label: sub.name,
      count:
        (counts.get(sub.id) ?? 0) +
        children.reduce((sum, child) => sum + (counts.get(child.id) ?? 0), 0),
      // A category without a photograph of its own borrows its first sub-category's.
      photo:
        familyImage(sub.id) ?? children.map((child) => familyImage(child.id)).find(Boolean) ?? null,
    };
  }

  readonly activeFilterCount = computed(() => {
    const query = this.store.query();
    return (
      (query.brands?.length ?? 0) + (query.industries?.length ?? 0) + (query.sizes?.length ?? 0)
    );
  });

  /** The company's banner opens page one of the grid, once two rows are on screen. */
  readonly showStory = computed(
    () =>
      this.store.page() === 1 &&
      this.store.view() === 'grid' &&
      this.store.products().length > STORY_AFTER,
  );
  readonly leadingProducts = computed(() =>
    this.showStory() ? this.store.products().slice(0, STORY_AFTER) : this.store.products(),
  );
  readonly remainingProducts = computed(() => this.store.products().slice(STORY_AFTER));

  fitOf(image: ProductImage) {
    return uniformImageFit(image);
  }

  isFamilyActive(id: string): boolean {
    return this.activeFamily()?.id === id;
  }

  isSubFamilyActive(id: string): boolean {
    return this.store.query().subcategories?.[0] === id;
  }

  /** A category toggles between itself and the whole division. */
  selectFamily(id: string): void {
    this.store.selectSub(this.isFamilyActive(id) ? null : id);
  }

  /** A sub-category toggles between itself and its parent category. */
  selectSubFamily(id: string): void {
    this.store.selectSub(this.isSubFamilyActive(id) ? (this.activeFamily()?.id ?? null) : id);
  }
  readonly filtersOpen = signal(false);
  searchTerm = '';

  /** The division being viewed, when the route is `/products/:category`. */
  readonly category = computed(() => {
    const ids = this.store.query().categories ?? [];
    return ids.length === 1 ? (CATEGORIES.find((c) => c.id === ids[0]) ?? null) : null;
  });

  /** "All products" is the current aisle only when no division filter is set at all. */
  readonly allActive = computed(() => !this.store.query().categories?.length);

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
