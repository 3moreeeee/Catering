/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { CartService } from '../../core/cart/cart.service';
import { Quote, QuoteKind } from '../../core/cart/cart.models';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { QuantityStepper } from '../../shared/components/quantity-stepper/quantity-stepper';

const PHONE_PATTERN = /^$|^[+0-9][0-9 .()/-]{5,28}$/;

/**
 * The panier, and its two exits.
 *
 * "Acheter" sends a direct order at the displayed prices; "Demander un devis"
 * asks for a negotiated offer, the path for large quantities. Neither form is
 * shown until the buyer picks one. Neither is a checkout: no payment is taken
 * on the site, and the commercial team confirms delivery and settlement
 * off-platform. Both are stored as a `Quote`, told apart by `kind`.
 */
@Component({
  selector: 'fk-cart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, QuantityStepper],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
})
export class CartPage {
  private readonly fb = inject(FormBuilder);
  private readonly links = inject(LocalizedRouter);
  private readonly transloco = inject(TranslocoService);
  readonly auth = inject(AuthService);
  readonly cartService = inject(CartService);

  readonly cart = this.cartService.cart;
  readonly busy = this.cartService.loading;
  readonly error = signal('');
  readonly submitted = signal<Quote | null>(null);
  readonly mode = signal<'choose' | QuoteKind>('choose');
  readonly loginUrl = this.links.url('login');
  readonly catalogUrl = this.links.url('products');

  readonly lines = computed(() => this.cart()?.items ?? []);
  readonly isEmpty = computed(() => this.lines().length === 0);

  readonly quoteForm = this.fb.nonNullable.group({
    contactName: ['', Validators.maxLength(200)],
    companyName: ['', Validators.maxLength(180)],
    contactPhone: ['', Validators.pattern(PHONE_PATTERN)],
    deliveryCity: ['', Validators.maxLength(120)],
    message: ['', Validators.maxLength(2000)],
  });

  constructor() {
    void this.cartService.refresh();

    // Start from the account's own details so a signed-in buyer rarely has to
    // type anything; only an untouched form is filled, never the buyer's edits.
    effect(() => {
      const user = this.auth.user();
      if (!user || this.quoteForm.dirty) return;
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
      this.quoteForm.patchValue({
        contactName: name,
        companyName: user.companyName ?? '',
        contactPhone: user.phone ?? '',
      });
    });
  }

  /**
   * Formats a price, or returns the "prix sur demande" label when there is none.
   * A missing price is never rendered as 0.
   */
  price(value: number | null, currency = 'TND'): string {
    if (value === null || value === undefined) {
      return this.transloco.translate('cart.priceOnRequest');
    }
    return `${value.toFixed(3)} ${currency}`;
  }

  /** Opens the order or quote form. An order needs a phone and a delivery city. */
  choose(kind: QuoteKind): void {
    const { contactPhone, deliveryCity } = this.quoteForm.controls;
    if (kind === 'ORDER') {
      contactPhone.setValidators([Validators.required, Validators.pattern(PHONE_PATTERN)]);
      deliveryCity.setValidators([Validators.required, Validators.maxLength(120)]);
    } else {
      contactPhone.setValidators(Validators.pattern(PHONE_PATTERN));
      deliveryCity.setValidators(Validators.maxLength(120));
    }
    contactPhone.updateValueAndValidity();
    deliveryCity.updateValueAndValidity();
    this.error.set('');
    this.mode.set(kind);
  }

  back(): void {
    this.error.set('');
    this.mode.set('choose');
  }

  async changeQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    this.error.set('');
    try {
      await this.cartService.updateQuantity(itemId, quantity);
    } catch {
      this.error.set(this.transloco.translate('cart.errorGeneric'));
    }
  }

  async remove(itemId: string): Promise<void> {
    this.error.set('');
    try {
      await this.cartService.removeItem(itemId);
    } catch {
      this.error.set(this.transloco.translate('cart.errorGeneric'));
    }
  }

  async clear(): Promise<void> {
    this.error.set('');
    try {
      await this.cartService.clear();
    } catch {
      this.error.set(this.transloco.translate('cart.errorGeneric'));
    }
  }

  async submit(): Promise<void> {
    const kind = this.mode();
    if (kind === 'choose' || this.quoteForm.invalid || this.isEmpty()) return;
    this.error.set('');
    try {
      const quote = await this.cartService.submit({ ...this.quoteForm.getRawValue(), kind });
      this.submitted.set(quote);
      this.quoteForm.reset();
      this.mode.set('choose');
    } catch (error) {
      const code = AuthService.errorCode(error);
      const key =
        code === 'order_unpriced' || code === 'order_contact_required'
          ? `cart.order.errors.${code}`
          : 'cart.errorSubmit';
      this.error.set(this.transloco.translate(key));
    }
  }
}
