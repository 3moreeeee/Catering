import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, shareReplay, switchMap } from 'rxjs';
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
import { ProductFormatService } from '../../shared/utils/product-format.service';
import { toMillimes } from '../../shared/utils/money';
import { PackText, packTermsOf } from '../../shared/utils/pack-text.service';

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
  private readonly formats = inject(ProductFormatService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly pack = inject(PackText);

  /** One direct slug lookup per route, shared by everything on the page that reads it. */
  private readonly product$ = this.route.paramMap.pipe(
    switchMap((params) => this.repo.bySlug(params.get('category') ?? '', params.get('slug') ?? '')),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** `done` distinguishes "still loading" from "no such product" (both have no product). */
  private readonly lookup = toSignal(
    this.product$.pipe(map((product) => ({ done: true, product }))),
    { initialValue: { done: false, product: null as Product | null } },
  );

  readonly product = computed(() => this.lookup().product);
  /** Set during server rendering only: lets a missing product answer 404. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /**
   * Four neighbours, scored and limited by the database. Requested from the
   * route's slug in parallel with the product itself rather than after it.
   */
  readonly related = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => this.repo.related(params.get('slug') ?? '', 4)),
      map((products) => products ?? []),
    ),
    { initialValue: [] as readonly Product[] },
  );

  readonly activeImage = signal(0);
  /** Same placeholder the product card shows for a reference without a photograph. */
  readonly placeholderImage = {
    src: imageKitMediaUrl('/img/products/placeholder.svg'),
    alt: { en: 'Product image not available', fr: 'Image du produit non disponible' },
  };
  readonly shareCopied = signal(false);
  readonly quantity = signal(1);
  readonly addState = signal<'idle' | 'adding' | 'added' | 'error'>('idle');
  readonly selectedColorId = signal<string | null>(null);
  readonly selectedColor = computed(
    () =>
      this.product()?.colorVariants?.find((variant) => variant.id === this.selectedColorId()) ??
      null,
  );
  readonly selectedColorLabel = computed(() => {
    const variant = this.selectedColor();
    return variant ? this.locales.text(variant.label) : null;
  });
  private lastColorRouteSlug: string | null = null;
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
    return product ? this.pricing.priceOf(this.selectedColorId() ?? product.id) : null;
  });

  /** Set only for a product sold by the pack: the stepper then counts packs. */
  readonly packTerms = computed(() => packTermsOf(this.pricePoint()));

  /**
   * Price × quantity in exact millimes. A unit product shows it once the buyer
   * asks for more than one; a pack product always shows it, beside the pieces
   * the packs amount to, so a pack count is never read as a piece count.
   */
  readonly subtotal = computed(() => {
    const point = this.pricePoint();
    const quantity = this.quantity();
    if (!point || point.price === null) return null;
    if (!this.packTerms() && quantity < 2) return null;
    return this.pack.moneyMillimes(toMillimes(point.price) * quantity, point.currency ?? 'TND');
  });

  readonly category = computed(() => CATEGORIES.find((c) => c.id === this.product()?.categoryId));
  readonly formatVisual = computed(() => {
    const product = this.product();
    return product ? this.formats.visual(product) : null;
  });

  readonly brand = computed(() => BRANDS.find((b) => b.id === this.product()?.brandId) ?? null);

  readonly industries = computed(() =>
    INDUSTRIES.filter((industry) => this.product()?.industries.includes(industry.id)),
  );

  constructor() {
    // Metadata (and the 404 status) once the database lookup has answered.
    effect(() => {
      if (!this.lookup().done) return;
      untracked(() => this.applySeo());
    });

    // Existing color-specific links continue to open the consolidated page
    // with their original, purchasable combination selected.
    effect(() => {
      const product = this.product();
      if (!product) return;
      const slug = this.route.snapshot.paramMap.get('slug');
      if (slug === this.lastColorRouteSlug) return;
      this.lastColorRouteSlug = slug;
      this.selectedColorId.set(
        slug === product.slug
          ? null
          : (product.colorVariants?.find((variant) => variant.slug === slug)?.id ?? null),
      );
    });

    // Fetch this reference's price as soon as the route resolves a product.
    effect(() => {
      const product = this.product();
      if (product) void this.pricing.prime([this.selectedColorId() ?? product.id]);
    });
  }

  selectColor(id: string): void {
    this.selectedColorId.set(id);
    this.addState.set('idle');
  }

  /** Formatted price, or the "prix sur demande" label when there is none. */
  displayPrice(): string {
    const point = this.pricePoint();
    return this.pack.price(point?.price, point?.currency);
  }

  /** Original price of an offer, in the same format as the price beside it. */
  money(amount: number, currency: string | null): string {
    return this.pack.price(amount, currency);
  }

  setQuantity(quantity: number): void {
    this.quantity.set(quantity);
    // A new quantity is a new intent: drop the "added" confirmation so it is
    // not read as confirming this figure.
    if (this.addState() !== 'adding') this.addState.set('idle');
  }

  async addToCart(): Promise<void> {
    if (this.product()?.colorVariants?.length && !this.selectedColor()) return;
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
      // A missing or deactivated product is a 404 for crawlers, not a 200 page.
      if (this.responseInit) this.responseInit.status = 404;
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
