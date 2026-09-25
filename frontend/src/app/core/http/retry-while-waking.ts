import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';

/** Retries after 1s, 2s, 4s and 8s, then gives up — about 15s of patience. */
export const WAKING_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;

/**
 * Bounded retry for safe, idempotent public GETs — catalogue and prices.
 *
 * The API host sleeps when idle and answers its first requests with a gateway
 * error or a dropped connection while it starts. Those are worth another try;
 * a 4xx is an answer, not an outage, and is never retried. Never use this on a
 * request that changes anything.
 */
export function retryWhileWaking<T>(): MonoTypeOperatorFunction<T> {
  return retry({
    count: WAKING_RETRY_DELAYS_MS.length,
    delay: (error: unknown, attempt: number) =>
      isTransient(error)
        ? timer(WAKING_RETRY_DELAYS_MS[attempt - 1] ?? 0)
        : throwError(() => error),
  });
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}
