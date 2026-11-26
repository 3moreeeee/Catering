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
import { TranslocoDirective } from '@jsverse/transloco';
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
import { uniformImageFit } from '../../utils/product-image-fit';
import { ProductFormatService } from '../../utils/product-format.service';
import { PackText, packTermsOf } from '../../utils/pack-text.service';
import { SHOW_PRICES } from '../../../core/config/catalogue-display';

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
      <article
        class="card"
        [class.card--list]="view() === 'list'"
        [attr.data-tone]="product().categoryId"
      >
        <a class="card__link" [routerLink]="detailLink()">
          <span class="u-visually-hidden">{{ product().name | localized }}</span>
        </a>

        <div
          class="card__media"
          [class.card__media--measured]="imageFit().measured"
          [style.--fit-scale]="imageFit().scale"
          [style.--fit-shift]="imageFit().shift + '%'"
        >
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

          @if (showPrices ? formatVisual() : null; as format) {
            <p
              class="card__format u-xs u-nums"
              [class.card__format--packaging]="product().categoryId === 'packaging'"
              [class.card__format--hygiene]="product().categoryId === 'hygiene'"
            >
              @if (format.icon === 'bottle') {
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 2h6v3l-1 2v2l2.5 3.5V21h-9v-8.5L10 9V7L9 5V2Z" />
                </svg>
              } @else if (format.icon === 'tray') {
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 9h20l-2.5 10h-15L2 9Zm2 0 3-4h10l3 4" />
                </svg>
              }
              <span
                >{{ t('product.format.' + format.qualifier) }}
                <strong>{{ format.value | frenchType }}</strong></span
              >
            </p>
          } @else if (showPrices ? formatLabel() : null; as formats) {
            <p class="card__format-fallback u-xs u-nums">{{ formats | frenchType }}</p>
          }

          @if (view() === 'list') {
            <p class="card__desc u-sm">{{ product().shortDescription | localized }}</p>
          }

          @if (!showPrices) {
            <!-- No published prices: the product's defining figure (its volume,
                 weight, size or pack) takes the price's place, in the same
                 type, so every card of a family reads the same way. -->
            <div class="card__spec">
              <span class="card__spec-text">
                @if (formatVisual(); as format) {
                  <span class="card__spec-label">{{ t('product.formatLabel') }}</span>
                  <strong class="card__spec-value u-nums">{{ format.value | frenchType }}</strong>
                } @else if (packTerms(); as terms) {
                  <span class="card__spec-label">{{ t('pack.packaging') }}</span>
                  <strong class="card__spec-value u-nums">{{
                    pack.pieces(terms.packQuantity, terms.unitLabel)
                  }}</strong>
                } @else if (pricePending()) {
                  <span class="card__spec-label">&nbsp;</span>
                  <span class="card__spec-pending"></span>
                } @else if (formatLabel(); as formats) {
                  <span class="card__spec-label">{{ t('product.formatLabel') }}</span>
                  <strong class="card__spec-value u-nums">{{ formats | frenchType }}</strong>
                } @else {
                  <span class="card__spec-label">{{ t('pack.packaging') }}</span>
                  <strong class="card__spec-value">{{ t('product.perUnitSale') }}</strong>
                }
              </span>
              <span class="card__spec-go" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" /></svg>
              </span>
            </div>
          } @else {
            <div class="card__buy">
              @if (pricePoint(); as point) {
                <p class="card__price u-nums">
                  @if (point.offerActive && point.originalPrice !== null) {
                    <span class="card__offer">{{ t('product.offer') }}</span>
                    <del>{{ displayPrice(point.originalPrice, point.currency) }}</del>
                  }
                  <strong
                    ><span class="card__amount">{{
                      displayPrice(point.price, point.currency)
                    }}</span>
                    @if (packTerms() && point.price !== null) {
                      &ngsp;<span class="card__per-pack">/ {{ t('pack.packs.one') }}</span>
                    }
                  </strong>
                </p>
                @if (packTerms(); as terms) {
                  <!-- Pack price first; what a pack holds and the piece price are secondary. -->
                  <p class="card__pack u-xs u-nums" data-testid="card-pack">
                    <span>{{ pack.soldBy(terms) }}</span>
                    @if (!point.offerActive) {
                      <span>{{ pack.perUnit(terms) }}</span>
                    }
                  </p>
                }
              } @else if (pricePending()) {
                <p class="card__price card__price--pending" aria-hidden="true"><span></span></p>
              }
            </div>
          }
        </div>

        <div class="card__actions">
          @if (!showPrices) {
            <!-- No prices, no basket: the one action is a quote request, opened
                 on the contact page with this product already named. -->
            <a
              class="btn btn--primary btn--sm card__action"
              [routerLink]="contactLink()"
              [queryParams]="{ product: product().slug }"
              [attr.aria-label]="
                t('product.requestQuoteAbout', { name: product().name | localized })
              "
            >
              {{ t('product.requestQuote') }}
            </a>
          } @else {
            @if (product().colorVariants?.length) {
              <a class="btn btn--primary btn--sm card__action" [routerLink]="detailLink()">
                {{ t('product.chooseColor') }}
              </a>
            } @else if (!auth.authenticated()) {
              <a class="btn btn--primary btn--sm card__action" [routerLink]="loginLink()">
                {{ t('product.addToCart') }}
              </a>
            } @else if (pricePoint()) {
              <button
                type="button"
                class="btn btn--primary btn--sm card__action"
                [disabled]="addState() === 'adding'"
                [attr.aria-label]="
                  t('product.addToCartAbout', { name: product().name | localized })
                "
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
              [attr.aria-label]="
                t('product.requestInfoAbout', { name: product().name | localized })
              "
            >
              {{ t('product.requestInfo') }}
            </a>
          }
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
  private readonly formats = inject(ProductFormatService);
  readonly auth = inject(AuthService);

  readonly showPrices = SHOW_PRICES;
  readonly addState = signal<'idle' | 'adding' | 'added' | 'error'>('idle');
  readonly pack = inject(PackText);
  readonly pricePoint = computed(() => this.pricing.priceOf(this.product().id));
  /** Set only for a product sold by the pack; one "Ajouter" then adds one pack. */
  readonly packTerms = computed(() => packTermsOf(this.pricePoint()));
  /** Holds the price's place while it loads, so the card does not jump when it lands. */
  readonly pricePending = computed(() => this.pricing.isPending(this.product().id));
  readonly loginLink = computed(() => this.links.path('login'));

  constructor() {
    effect(() => this.pricing.request(this.product().id));
  }

  displayPrice(price: number | null, currency: string | null): string {
    return this.pack.price(price, currency);
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
  readonly imageFit = computed(() => uniformImageFit(this.product().images[0]));

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

  readonly formatVisual = computed(() => this.formats.visual(this.product()));

  readonly detailLink = computed(() => {
    const product = this.product();
    const categorySlug =
      CATEGORIES.find((c) => c.id === product.categoryId)?.slug ?? product.categoryId;
    return this.links.path(`products/${categorySlug}/${product.slug}`);
  });

  readonly contactLink = computed(() => this.links.path('contact'));
}
