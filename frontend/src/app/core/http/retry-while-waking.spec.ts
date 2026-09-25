import { HttpErrorResponse } from '@angular/common/http';
import { defer, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryWhileWaking } from './retry-while-waking';

/** A source that fails with `status` for the first `failures` subscriptions. */
function flaky(status: number, failures: number) {
  let calls = 0;
  const source = defer(() =>
    ++calls <= failures ? throwError(() => new HttpErrorResponse({ status })) : of('ok'),
  );
  return { source, calls: () => calls };
}

describe('retryWhileWaking', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries a waking backend (503, dropped connection) until it answers', async () => {
    const { source, calls } = flaky(503, 2);
    const result = firstValueFrom(source.pipe(retryWhileWaking()));
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    await expect(result).resolves.toBe('ok');
    expect(calls()).toBe(3);

    const dropped = flaky(0, 1);
    const second = firstValueFrom(dropped.source.pipe(retryWhileWaking()));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(second).resolves.toBe('ok');
  });

  it('never retries a 4xx answer', async () => {
    const { source, calls } = flaky(404, 5);
    await expect(firstValueFrom(source.pipe(retryWhileWaking()))).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );
    expect(calls()).toBe(1);
  });

  it('gives up after four retries instead of retrying forever', async () => {
    const { source, calls } = flaky(503, 100);
    const result = firstValueFrom(source.pipe(retryWhileWaking()));
    const settled = expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000);
    await settled;
    expect(calls()).toBe(5);
  });
});
