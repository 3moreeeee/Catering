import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { ProductCard } from '../../../shared/components/cards/product-card';
import { CategoryId, Product } from '../../../shared/models/catalog.model';

/**
 * Section 4 — featured products, tabbed by division.
 *
 * Implements the WAI-ARIA tabs pattern properly: roving tabindex, arrow-key
 * navigation with Home/End, and panels associated by `aria-controls`. Switching
 * tabs filters an already-loaded list; nothing is refetched.
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
            {{ t('home.featured.viewAll', { count: total() }) }}
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
  private readonly featured = toSignal(this.productRepo.featured(40), {
    initialValue: [] as readonly Product[],
  });
  private readonly allProducts = toSignal(this.productRepo.all(), { initialValue: [] });

  /**
   * Products shown per division.
   *
   * Five, so the showcase is a single row on desktop and remains a deliberate
   * selection rather than becoming a second catalogue.
   */
  private static readonly SHOWCASE_SIZE = 5;

  readonly total = computed(() => this.allProducts().length);
  readonly active = signal<CategoryId>('food');

  productsFor(id: CategoryId): readonly Product[] {
    const inCategory = (product: Product): boolean => product.categoryId === id;

    const curated = this.featured().filter(inCategory);
    if (curated.length >= FeaturedSection.SHOWCASE_SIZE) {
      return curated.slice(0, FeaturedSection.SHOWCASE_SIZE);
    }

    // Top up from the wider catalogue so the showcase is always a complete
    // grid. Curated picks keep their order at the front; the rest fills in
    // behind them, skipping records whose details are still unverified so the
    // homepage leads with the products we can actually stand behind.
    const seen = new Set(curated.map((product) => product.id));
    const filler = this.allProducts().filter(
      (product) => inCategory(product) && !seen.has(product.id) && !product.needsVerification,
    );

    return [...curated, ...filler].slice(0, FeaturedSection.SHOWCASE_SIZE);
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
