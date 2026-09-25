import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IDENTITY_API_URL } from '../auth/identity-api.token';
import { Cart, Quote, QuoteSubmitPayload } from './cart.models';

/**
 * The panier, held server-side.
 *
 * There is no local-storage fallback for anonymous visitors: the cart belongs to
 * an account, because its only exit is a professional quote request that has to
 * be attributable to a buyer. Components check `authenticated` on AuthService and
 * route to login before offering "ajouter au panier".
 *
 * The cart takes no payment. Submitting it creates either a direct order at the
 * displayed prices or a demande de devis (`kind`); the commercial team confirms
 * either one off-platform.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly cart = signal<Cart | null>(null);
  readonly loading = signal(false);
  readonly itemCount = computed(() => this.cart()?.itemCount ?? 0);
  readonly totalQuantity = computed(() => this.cart()?.totalQuantity ?? 0);
  readonly isEmpty = computed(() => this.itemCount() === 0);

  /** Loads the cart once the visitor is known to be signed in. */
  async refresh(): Promise<Cart | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    const user = await this.auth.ensureLoaded();
    if (!user) {
      this.cart.set(null);
      return null;
    }
    return this.run(() => this.http.get<Cart>(`${this.apiUrl}/cart`, { withCredentials: true }));
  }

  addItem(productId: string, quantity = 1, formatValue?: string): Promise<Cart | null> {
    return this.run(() =>
      this.http.post<Cart>(
        `${this.apiUrl}/cart/items`,
        { productId, quantity, formatValue: formatValue ?? null },
        { withCredentials: true },
      ),
    );
  }

  updateQuantity(itemId: string, quantity: number): Promise<Cart | null> {
    return this.run(() =>
      this.http.put<Cart>(
        `${this.apiUrl}/cart/items/${itemId}`,
        { quantity },
        { withCredentials: true },
      ),
    );
  }

  removeItem(itemId: string): Promise<Cart | null> {
    return this.run(() =>
      this.http.delete<Cart>(`${this.apiUrl}/cart/items/${itemId}`, { withCredentials: true }),
    );
  }

  clear(): Promise<Cart | null> {
    return this.run(() =>
      this.http.delete<Cart>(`${this.apiUrl}/cart`, { withCredentials: true }),
    );
  }

  /**
   * Converts the panier into a demande de devis.
   *
   * The cart signal is refreshed afterwards because the server retires the
   * submitted one and the next add-to-cart opens a fresh, empty cart.
   */
  async submit(payload: QuoteSubmitPayload = {}): Promise<Quote> {
    this.loading.set(true);
    try {
      const quote = await firstValueFrom(
        this.http.post<Quote>(`${this.apiUrl}/cart/submit`, payload, { withCredentials: true }),
      );
      await this.refresh();
      return quote;
    } finally {
      this.loading.set(false);
    }
  }

  myQuotes(): Promise<Quote[]> {
    return firstValueFrom(
      this.http.get<Quote[]>(`${this.apiUrl}/quotes/me`, { withCredentials: true }),
    );
  }

  private async run(call: () => ReturnType<HttpClient['get']>): Promise<Cart | null> {
    this.loading.set(true);
    try {
      const cart = (await firstValueFrom(call())) as Cart;
      this.cart.set(cart);
      return cart;
    } finally {
      this.loading.set(false);
    }
  }
}
