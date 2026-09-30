import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_API_URL } from '../auth/identity-api.token';
import { ProductPricePoint } from './cart.models';
import { retryWhileWaking } from '../http/retry-while-waking';

/**
 * Catalogue prices for the products a page renders.
 *
 * Catalogue responses already carry each product's price terms, so the product
 * repository seeds them here (`seed`) as pages, products and selections
 * arrive — during server rendering too, so the HTML a crawler or a visitor
 * receives already shows the price, and the hydrating browser (fed the same
 * responses by the transfer cache) shows the same one without a request.
 *
 * Ids no catalogue response covered — another colour of a line, a cart line —
 * are fetched in the browser, in one batched request per tick, and cached for
 * the session.
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly platformId = inject(PLATFORM_ID);

  /** sourceId -> price point. Null marks an id the API does not know. */
  private readonly cache = new Map<string, ProductPricePoint | null>();
  private readonly inFlight = new Map<string, Promise<void>>();
  /** Ids whose load failed after every retry; they stop showing as pending. */
  private readonly failed = new Set<string>();

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
    this.failed.delete(sourceId);
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

  /** Records price terms that arrived with catalogue responses; never overwritten by a stale value. */
  seed(points: readonly ProductPricePoint[]): void {
    if (!points.length) return;
    points.forEach((point) => {
      this.cache.set(point.sourceId, point);
      this.failed.delete(point.sourceId);
    });
    this.revision.update((value) => value + 1);
  }

  priceOf(sourceId: string): ProductPricePoint | null {
    this.revision();
    return this.cache.get(sourceId) ?? null;
  }

  /**
   * True while a price is still to come: not yet answered and not given up on.
   * An id the API answered without a price is not pending — it has no price.
   */
  isPending(sourceId: string): boolean {
    this.revision();
    if (this.cache.has(sourceId)) return false;
    // The server fetches nothing itself: what the catalogue responses did not
    // seed stays a placeholder, exactly as the hydrating browser first shows it.
    if (!isPlatformBrowser(this.platformId)) return true;
    return !this.failed.has(sourceId);
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
        this.http
          .get<ProductPricePoint[]>(`${this.apiUrl}/products/prices`, {
            params: new HttpParams().set('sourceIds', sourceIds.join(',')),
          })
          .pipe(retryWhileWaking()),
      );
      points.forEach((point) => this.cache.set(point.sourceId, point));
      // Remember the misses too, so an id the catalogue has but the API does not
      // is asked for once rather than on every render.
      sourceIds.filter((id) => !this.cache.has(id)).forEach((id) => this.cache.set(id, null));
    } catch {
      // Given up after the bounded retries. The ids stay uncached, so the next
      // render that asks for them tries again; until then they are not shown as
      // pending, which would be a placeholder that never resolves.
      sourceIds.forEach((id) => this.failed.add(id));
    }
  }
}
