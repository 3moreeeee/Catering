import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { ProductCard } from '../../../shared/components/cards/product-card';
import { CATEGORY_IDS, CategoryId, Product } from '../../../shared/models/catalog.model';
import { CatalogStats } from '../../../core/catalog/catalog-stats.service';

/**
 * Section 4 — featured products, tabbed by division.
 *
 * Implements the WAI-ARIA tabs pattern properly: roving tabindex, arrow-key
 * navigation with Home/End, and panels associated by `aria-controls`. Every
 * panel is loaded with the page; switching tabs refetches nothing.
 */
@Component({
  selector: 'fk-featured-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, ProductCard],
  template: `
    <ng-container *transloco="let t">
      <div class="container featured__inner">
        <header class="featured__head">
          <div>
            <p class="u-eyebrow">{{ t('home.featured.eyebrow') }}</p>
            <h2 class="featured__title">{{ t('home.featured.title') }}</h2>
          </div>

          <div
            class="featured__tabs"
            role="tablist"
            [attr.aria-label]="t('home.featured.tabsLabel')"
          >
            @for (category of categories(); track category.id; let i = $index) {
              <button
                type="button"
                role="tab"
                class="chip featured__tab"
                [id]="'featured-tab-' + category.id"
                [attr.aria-selected]="active() === category.id"
                [attr.aria-controls]="'featured-panel-' + category.id"
                [attr.tabindex]="active() === category.id ? 0 : -1"
                [class.chip--active]="active() === category.id"
                (click)="active.set(category.id)"
                (keydown)="onTabKeydown($event)"
              >
                {{ category.shortName | localized }}
              </button>
            }
          </div>
        </header>

        @for (category of categories(); track category.id) {
          <div
            role="tabpanel"
            [id]="'featured-panel-' + category.id"
            [attr.aria-labelledby]="'featured-tab-' + category.id"
            [hidden]="active() !== category.id"
            tabindex="0"
          >
            <ul class="featured__grid">
              @for (product of productsFor(category.id); track product.id) {
                <li><fk-product-card [product]="product" /></li>
              }
            </ul>
          </div>
        }

        <div class="featured__foot">
          <a class="btn btn--secondary btn--lg" [routerLink]="to('products')">
            @if (total(); as count) {
              {{ t('home.featured.viewAll', { count }) }}
            } @else {
              {{ t('footer.allProducts') }}
            }
          </a>
        </div>
      </div>
    </ng-container>
  `,
  styleUrl: './featured-section.scss',
})
export class FeaturedSection {
  private readonly links = inject(LocalizedRouter);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);
  private readonly productRepo = inject(PRODUCT_REPOSITORY);

  readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });

  /**
   * Products shown per division.
   *
   * Five, so the showcase is a single row on desktop and remains a deliberate
   * selection rather than becoming a second catalogue.
   */
  private static readonly SHOWCASE_SIZE = 5;

  /**
   * Each division's showcase, selected by the database: curated (featured)
   * products first, then verified ones. Four bounded requests, fetched once
   * during server rendering and handed to the browser by the transfer cache.
   */
  private readonly showcase = toSignal(
    forkJoin(
      CATEGORY_IDS.map((id) =>
        this.productRepo
          .featured(FeaturedSection.SHOWCASE_SIZE, id)
          .pipe(map((items) => [id, items] as const)),
      ),
    ).pipe(map((entries) => new Map<CategoryId, readonly Product[]>(entries))),
    { initialValue: new Map<CategoryId, readonly Product[]>() },
  );

  readonly total = inject(CatalogStats).total;
  readonly active = signal<CategoryId>('food');

  productsFor(id: CategoryId): readonly Product[] {
    return this.showcase().get(id) ?? [];
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  /** Arrow / Home / End navigation, as the tabs pattern requires. */
  onTabKeydown(event: KeyboardEvent): void {
    const ids = this.categories().map((c) => c.id);
    const currentIndex = ids.indexOf(this.active());
    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % ids.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + ids.length) % ids.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = ids.length - 1;
        break;
      default:
        return;
    }

    const nextId = ids[nextIndex];
    if (nextId) {
      event.preventDefault();
      this.active.set(nextId);
      const tab = event.currentTarget as HTMLElement;
      tab
        .closest('[role="tablist"]')
        ?.querySelector<HTMLButtonElement>(`#featured-tab-${nextId}`)
        ?.focus();
    }
  }
}
