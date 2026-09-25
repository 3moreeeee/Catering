import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_API_URL } from '../auth/identity-api.token';
import { ProductPricePoint } from './cart.models';

/**
 * Looks catalogue prices up from the API for products the page is rendering.
 *
 * The bundled catalogue snapshot deliberately carries no prices — it is the
 * search, facet and prerender source, and baking prices into the JavaScript
 * bundle would freeze them at build time. Prices are therefore fetched at
 * runtime, in one batched request per rendered page, and cached for the session.
 *
 * On the server during SSR nothing is fetched: prerendered HTML must not embed a
 * price that may since have changed, so the price appears on hydration.
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly platformId = inject(PLATFORM_ID);

  /** sourceId -> price point. Null marks an id the API does not know. */
  private readonly cache = new Map<string, ProductPricePoint | null>();
  private readonly inFlight = new Map<string, Promise<void>>();

  /** Bumped after every load so templates reading `priceOf` re-evaluate. */
  readonly revision = signal(0);

  private pending = new Set<string>();
  private flushScheduled = false;

  /**
   * Asks for one id's price, coalescing with every other request made in the
   * same tick. A catalogue page renders a card per product and each card asks
   * for itself; without coalescing that is one HTTP request per card.
   */
  request(sourceId: string): void {
    if (!isPlatformBrowser(this.platformId) || this.cache.has(sourceId)) return;
    this.pending.add(sourceId);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      const batch = [...this.pending];
      this.pending = new Set();
      this.flushScheduled = false;
      void this.prime(batch);
    });
  }

  priceOf(sourceId: string): ProductPricePoint | null {
    this.revision();
    return this.cache.get(sourceId) ?? null;
  }

  /** Drops a back-office-edited price so the next catalogue render reloads it. */
  invalidate(sourceId: string): void {
    this.cache.delete(sourceId);
    this.revision.update((value) => value + 1);
  }

  /**
   * Fetches any ids not already cached.
   *
   * The batch is capped at 200 by the API, so long lists are chunked rather than
   * rejected. Failures are swallowed: a catalogue that renders without prices is
   * degraded but usable, and the alternative is an empty page.
   */
  async prime(sourceIds: readonly string[]): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const missing = [...new Set(sourceIds)].filter(
      (id) => !this.cache.has(id) && !this.inFlight.has(id),
    );
    if (missing.length === 0) return;

    const chunks: string[][] = [];
    for (let index = 0; index < missing.length; index += 200) {
      chunks.push(missing.slice(index, index + 200));
    }

    await Promise.all(
      chunks.map((chunk) => {
        const request = this.load(chunk).finally(() => {
          chunk.forEach((id) => this.inFlight.delete(id));
        });
        chunk.forEach((id) => this.inFlight.set(id, request));
        return request;
      }),
    );
    this.revision.update((value) => value + 1);
  }

  private async load(sourceIds: string[]): Promise<void> {
    try {
      const points = await firstValueFrom(
        this.http.get<ProductPricePoint[]>(`${this.apiUrl}/products/prices`, {
          params: new HttpParams().set('sourceIds', sourceIds.join(',')),
        }),
      );
      points.forEach((point) => this.cache.set(point.sourceId, point));
      // Remember the misses too, so an id the catalogue has but the API does not
      // is asked for once rather than on every render.
      sourceIds.filter((id) => !this.cache.has(id)).forEach((id) => this.cache.set(id, null));
    } catch {
      // Leave the ids uncached so a later navigation can retry.
    }
  }
}
