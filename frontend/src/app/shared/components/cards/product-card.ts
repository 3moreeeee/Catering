import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { CartService } from '../../../core/cart/cart.service';
import { PricingService } from '../../../core/cart/pricing.service';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { LocalizedTextPipe } from '../../pipes/localized-text.pipe';
import { FrenchTypographyPipe } from '../../pipes/french-typography.pipe';
import { Product } from '../../models/catalog.model';
import { BRANDS } from '../../../data/brands.data';
import { CATEGORIES } from '../../../data/categories.data';
import { imageKitMediaUrl } from '../../../core/config/imagekit.generated';

/**
 * Product card.
 *
 * The whole card is one link with one accessible name; the enquiry action is a
 * separate link layered above it, so a keyboard user gets exactly two
 * predictable tab stops rather than a nest of links.
 *
 * There was a third control — "Aperçu rapide" — which emitted a `quickView`
 * output that nothing in the application listened to. Pressing it did nothing,
 * anywhere, in either language. A control that looks operable and is not costs
 * more trust than the feature would have bought, so it is gone until a real
 * quick-view dialog exists; the card already links to the full product page,
 * which is where that information lives today.
 *
 * The price and the add-to-panier action come from the catalogue API at runtime
 * (the bundled catalogue carries no prices). A reference without a supplied price
 * shows "prix sur demande", never 0. An anonymous visitor is sent to sign in,
 * because a panier belongs to an account. Administrators use the same action,
 * which also lets them verify the customer journey from the catalogue.
 */
@Component({
  selector: 'fk-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, FrenchTypographyPipe],
  template: `
    <ng-container *transloco="let t">
      <article class="card" [class.card--list]="view() === 'list'">
        <a class="card__link" [routerLink]="detailLink()">
          <span class="u-visually-hidden">{{ product().name | localized }}</span>
        </a>

        <div class="card__media">
          <img
            [src]="imageSrc()"
            (error)="onImageError()"
            [alt]="image().alt | localized"
            [width]="image().width"
            [height]="image().height"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div class="card__body">
          @if (brandName(); as brand) {
            <p class="card__brand u-label">{{ brand }}</p>
          } @else {
            <p class="card__brand u-label card__brand--none">{{ categoryName() | localized }}</p>
          }

          <h3 class="card__name">{{ product().name | localized | frenchType }}</h3>

          @if (formatLabel(); as formats) {
            <p class="card__format u-xs u-nums">{{ formats | frenchType }}</p>
          }

          @if (view() === 'list') {
            <p class="card__desc u-sm">{{ product().shortDescription | localized }}</p>
          }

          @if (pricePoint(); as point) {
            <p class="card__price u-nums">
              @if (point.offerActive && point.originalPrice !== null) {
                <span class="card__offer">{{ t('product.offer') }}</span>
                <del>{{ displayPrice(point.originalPrice, point.currency) }}</del>
              }
              <strong>{{ displayPrice(point.price, point.currency) }}</strong>
            </p>
          } @else if (pricePending()) {
            <p class="card__price card__price--pending" aria-hidden="true"><span></span></p>
          }
        </div>

        <div class="card__actions">
          @if (!auth.authenticated()) {
            <a class="btn btn--primary btn--sm card__action" [routerLink]="loginLink()">
              {{ t('product.addToCart') }}
            </a>
          } @else if (pricePoint()) {
            <button
              type="button"
              class="btn btn--primary btn--sm card__action"
              [disabled]="addState() === 'adding'"
              [attr.aria-label]="t('product.addToCartAbout', { name: product().name | localized })"
              (click)="addToCart()"
            >
              {{
                addState() === 'added'
                  ? t('product.added')
                  : addState() === 'error'
                    ? t('product.addFailed')
                    : t('product.addToCart')
              }}
            </button>
          }
          <a
            class="btn btn--secondary btn--sm card__action"
            [routerLink]="contactLink()"
            [queryParams]="{ product: product().slug }"
            [attr.aria-label]="t('product.requestInfoAbout', { name: product().name | localized })"
          >
            {{ t('product.requestInfo') }}
          </a>
        </div>
      </article>
    </ng-container>
  `,
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly view = input<'grid' | 'list'>('grid');

  private readonly links = inject(LocalizedRouter);
  private readonly pricing = inject(PricingService);
  private readonly cart = inject(CartService);
  private readonly transloco = inject(TranslocoService);
  readonly auth = inject(AuthService);

  readonly addState = signal<'idle' | 'adding' | 'added' | 'error'>('idle');
  readonly pricePoint = computed(() => this.pricing.priceOf(this.product().id));
  /** Holds the price's place while it loads, so the card does not jump when it lands. */
  readonly pricePending = computed(() => this.pricing.isPending(this.product().id));
  readonly loginLink = computed(() => this.links.path('login'));

  constructor() {
    effect(() => this.pricing.request(this.product().id));
  }

  displayPrice(price: number | null, currency: string | null): string {
    return price === null
      ? this.transloco.translate('cart.priceOnRequest')
      : `${price.toFixed(3)} ${currency ?? 'TND'}`;
  }

  async addToCart(): Promise<void> {
    const point = this.pricePoint();
    if (!point) return;
    this.addState.set('adding');
    try {
      await this.cart.addItem(point.id, 1);
      this.addState.set('added');
      // Back to the resting label, so the button reads as reusable for a
      // second unit rather than as a finished, disabled state.
      setTimeout(() => this.addState.set('idle'), 2000);
    } catch {
      this.addState.set('error');
    }
  }

  private static readonly FALLBACK_IMAGE = {
    src: imageKitMediaUrl('/img/products/placeholder.svg'),
    alt: { en: 'Product image not available', fr: 'Image du produit non disponible' },
    width: 800,
    height: 800,
  };

  readonly image = computed(() => this.product().images[0] ?? ProductCard.FALLBACK_IMAGE);

  /**
   * Safety net for a dead image URL.
   *
   * The fallback on `image()` only covers a MISSING record; it does nothing for
   * a record whose src 404s, which is what happens when catalogue data and
   * uploaded files drift apart. Without this the user sees a broken-image glyph.
   */
  private readonly imageFailed = signal(false);

  readonly imageSrc = computed(() =>
    this.imageFailed() ? ProductCard.FALLBACK_IMAGE.src : this.image().src,
  );

  onImageError(): void {
    this.imageFailed.set(true);
  }

  readonly brandName = computed(() => {
    const id = this.product().brandId;
    return id ? (BRANDS.find((b) => b.id === id)?.name ?? null) : null;
  });

  readonly categoryName = computed(
    () =>
      CATEGORIES.find((c) => c.id === this.product().categoryId)?.shortName ?? {
        en: '',
        fr: '',
      },
  );

  readonly formatLabel = computed(() => {
    const formats = this.product().formats;
    return formats.length ? formats.map((f) => f.value).join(' · ') : null;
  });

  readonly detailLink = computed(() => {
    const product = this.product();
    const categorySlug =
      CATEGORIES.find((c) => c.id === product.categoryId)?.slug ?? product.categoryId;
    return this.links.path(`products/${categorySlug}/${product.slug}`);
  });

  readonly contactLink = computed(() => this.links.path('contact'));
}
