import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { PRODUCT_REPOSITORY } from '../../data/repositories/catalog.repository';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { FrenchTypographyPipe } from '../../shared/pipes/french-typography.pipe';
import { ProductCard } from '../../shared/components/cards/product-card';
import { QuantityStepper } from '../../shared/components/quantity-stepper/quantity-stepper';
import { CATEGORIES } from '../../data/categories.data';
import { BRANDS } from '../../data/brands.data';
import { INDUSTRIES } from '../../data/industries.data';
import { Product } from '../../shared/models/catalog.model';
import { AuthService } from '../../core/auth/auth.service';
import { CartService } from '../../core/cart/cart.service';
import { PricingService } from '../../core/cart/pricing.service';
import { imageKitMediaUrl } from '../../core/config/imagekit.generated';

/**
 * Product detail page.
 *
 * The conversion surface: every route out of here leads either to the panier or
 * to an enquiry with the product attached.
 *
 * The price and the add-to-panier control are fetched from the API at runtime
 * rather than read from the bundled catalogue, so a back-office edit shows up
 * without a rebuild. A reference the company has not priced renders "prix sur
 * demande" — the absence is explained rather than left as a suspicious gap, and
 * is never shown as 0.
 */
@Component({
  selector: 'fk-product-details-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoDirective,
    LocalizedTextPipe,
    FrenchTypographyPipe,
    ProductCard,
    QuantityStepper,
  ],
  templateUrl: './product-details.page.html',
  styleUrl: './product-details.page.scss',
})
export class ProductDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly repo = inject(PRODUCT_REPOSITORY);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly pricing = inject(PricingService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);

  readonly product = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.repo.bySlug(params.get('category') ?? '', params.get('slug') ?? ''),
      ),
    ),
    { initialValue: null },
  );

  readonly related = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.repo.bySlug(params.get('category') ?? '', params.get('slug') ?? ''),
      ),
      switchMap((product) => (product ? this.repo.related(product, 4) : [])),
      map((products) => products ?? []),
    ),
    { initialValue: [] as readonly Product[] },
  );

  readonly activeImage = signal(0);
  readonly shareCopied = signal(false);
  readonly quantity = signal(1);
  readonly addState = signal<'idle' | 'adding' | 'added' | 'error'>('idle');
  readonly cartUrl = this.links.url('cart');
  readonly loginUrl = this.links.url('login');

  /**
   * The live price for this reference, or null when the company publishes none.
   *
   * The bundled catalogue carries no prices — they are fetched at runtime so an
   * edit in the back office is reflected without a rebuild.
   */
  readonly pricePoint = computed(() => {
    const product = this.product();
    return product ? this.pricing.priceOf(product.id) : null;
  });

  /** Price × quantity, shown only once the buyer asks for more than one unit. */
  readonly subtotal = computed(() => {
    const point = this.pricePoint();
    const quantity = this.quantity();
    if (!point || point.price === null || quantity < 2) return null;
    return `${(point.price * quantity).toFixed(3)} ${point.currency ?? 'TND'}`;
  });

  readonly category = computed(() => CATEGORIES.find((c) => c.id === this.product()?.categoryId));

  readonly subcategory = computed(() => {
    const product = this.product();
    return this.category()?.subcategories.find((s) => s.id === product?.subcategoryId) ?? null;
  });

  readonly brand = computed(() => BRANDS.find((b) => b.id === this.product()?.brandId) ?? null);

  readonly industries = computed(() =>
    INDUSTRIES.filter((industry) => this.product()?.industries.includes(industry.id)),
  );

  constructor() {
    queueMicrotask(() => this.applySeo());

    // Fetch this reference's price as soon as the route resolves a product.
    effect(() => {
      const product = this.product();
      if (product) void this.pricing.prime([product.id]);
    });
  }

  /** Formatted price, or the "prix sur demande" label when there is none. */
  displayPrice(): string {
    const point = this.pricePoint();
    if (!point || point.price === null) {
      return this.transloco.translate('cart.priceOnRequest');
    }
    return `${point.price.toFixed(3)} ${point.currency ?? 'TND'}`;
  }

  setQuantity(quantity: number): void {
    this.quantity.set(quantity);
    // A new quantity is a new intent: drop the "added" confirmation so it is
    // not read as confirming this figure.
    if (this.addState() !== 'adding') this.addState.set('idle');
  }

  async addToCart(): Promise<void> {
    const point = this.pricePoint();
    if (!point) return;
    this.addState.set('adding');
    try {
      await this.cart.addItem(point.id, Math.max(1, this.quantity()));
      this.addState.set('added');
    } catch {
      this.addState.set('error');
    }
  }

  private applySeo(): void {
    const product = this.product();
    const category = this.category();
    if (!product || !category) {
      this.seo.apply({
        title: this.transloco.translate('notFound.title'),
        description: '',
        path: 'products',
        noIndex: true,
      });
      return;
    }

    const path = `products/${category.slug}/${product.slug}`;
    this.seo.apply({
      title: this.locales.text(product.seo.title),
      description: this.locales.text(product.seo.description),
      path,
      type: 'product',
      image: product.images[0]?.src,
    });

    this.jsonLd.set([
      this.jsonLd.organization(),
      this.jsonLd.product(product, this.links.url(path)),
      this.jsonLd.breadcrumbs([
        { name: this.transloco.translate('nav.home'), path: this.links.url('') },
        { name: this.transloco.translate('catalog.title'), path: this.links.url('products') },
        {
          name: this.locales.text(category.name),
          path: this.links.url(`products/${category.slug}`),
        },
        { name: this.locales.text(product.name), path: this.links.url(path) },
      ]),
    ]);
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  /** Falls back to the shared placeholder if a product photo fails to load. */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('placeholder.svg')) {
      img.src = imageKitMediaUrl('/img/products/placeholder.svg');
    }
  }

  async share(): Promise<void> {
    const url = globalThis.location?.href ?? '';
    try {
      if (navigator.share) {
        await navigator.share({ title: this.locales.text(this.product()!.name), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2400);
    } catch {
      // User dismissed the share sheet, or the clipboard is unavailable.
      // Neither is an error worth surfacing.
    }
  }
}
