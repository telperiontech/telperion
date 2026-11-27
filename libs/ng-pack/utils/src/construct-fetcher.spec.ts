import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import type { Injector } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { constructFetcher } from './construct-fetcher';
import type { FetcherError } from './fetcher';

type Response = { token: string };

const OFFLINE = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error', url: '/auth/refresh' });
const UNAUTHORIZED = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', url: '/auth/refresh' });
const offline = (error: FetcherError) => error instanceof HttpErrorResponse && error.status === 0;

/**
 * An `HttpClient` stub whose `post` answers with the given observables, one per request
 */
function setup(...responses: Observable<Response>[]) {
  const post = vi.fn((..._args: unknown[]) => responses.shift() ?? throwError(() => new Error('no more responses')));
  const client = { post } as unknown as HttpClient;
  const injector = { get: (token: unknown) => (token === HttpClient ? client : undefined) } as unknown as Injector;

  return { post, fetcher: constructFetcher(injector) };
}

describe('constructFetcher', () => {
  it('resolves with [null, response] on success', async () => {
    const { fetcher, post } = setup(of({ token: 'a' }));

    await expect(fetcher.post<Response>('/auth/refresh', null, { withCredentials: true })).resolves.toEqual([null, { token: 'a' }]);
    expect(post).toHaveBeenCalledWith('/auth/refresh', null, { withCredentials: true });
  });

  it('resolves with [error, null] without retrying by default', async () => {
    const { fetcher, post } = setup(throwError(() => OFFLINE), of({ token: 'a' }));

    await expect(fetcher.post<Response>('/auth/refresh', null)).resolves.toEqual([OFFLINE, null]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('throws for properties HttpClient does not have', () => {
    const { fetcher } = setup();

    expect(() => (fetcher as unknown as Record<string, unknown>)['nope']).toThrow('HttpClient does not have method nope');
  });

  describe('withRetry', () => {
    it('succeeds after network failures, sending the request again on each attempt', async () => {
      const { fetcher, post } = setup(throwError(() => OFFLINE), throwError(() => OFFLINE), of({ token: 'b' }));
      const result = await fetcher.withRetry({ count: 3, when: offline }).post<Response>('/auth/refresh', null, { withCredentials: true });

      expect(result).toEqual([null, { token: 'b' }]);
      expect(post).toHaveBeenCalledTimes(3);
      expect(post.mock.calls.every(args => args[0] === '/auth/refresh')).toBe(true);
    });

    it('does not retry when `when` returns false', async () => {
      const { fetcher, post } = setup(throwError(() => UNAUTHORIZED), of({ token: 'b' }));
      const when = vi.fn(offline);
      const result = await fetcher.withRetry({ count: 3, when }).post<Response>('/auth/refresh', null);

      expect(result).toEqual([UNAUTHORIZED, null]);
      expect(post).toHaveBeenCalledTimes(1);
      expect(when).toHaveBeenCalledWith(UNAUTHORIZED, 1);
    });

    it('resolves with the last error once `count` retries are used up', async () => {
      const errors = [0, 1, 2].map(i => new HttpErrorResponse({ status: 0, statusText: `attempt ${i}` }));
      const { fetcher, post } = setup(...errors.map(error => throwError(() => error)), of({ token: 'late' }));
      const result = await fetcher.withRetry({ count: 2, when: offline }).post<Response>('/auth/refresh', null);

      expect(result).toEqual([errors[2], null]);
      expect(post).toHaveBeenCalledTimes(3);
    });

    it('waits the delay before each retry, passing the retry number and the error', async () => {
      vi.useFakeTimers();

      try {
        const { fetcher, post } = setup(throwError(() => OFFLINE), throwError(() => OFFLINE), of({ token: 'c' }));
        const delay = vi.fn((attempt: number, _error: FetcherError) => 1000 * 2 ** attempt);
        const pending = fetcher.withRetry({ count: 3, delay }).post<Response>('/auth/refresh', null);

        await vi.advanceTimersByTimeAsync(1999);
        expect(post).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(post).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(4000);
        await expect(pending).resolves.toEqual([null, { token: 'c' }]);
        expect(delay.mock.calls).toEqual([[1, OFFLINE], [2, OFFLINE]]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('leaves the original fetcher without retries, and a second withRetry replaces the options', async () => {
      const { fetcher, post } = setup(
        throwError(() => OFFLINE),
        throwError(() => OFFLINE),
        throwError(() => OFFLINE),
        of({ token: 'd' }),
      );
      const retrying = fetcher.withRetry({ count: 5 });

      await expect(fetcher.post<Response>('/x', null)).resolves.toEqual([OFFLINE, null]);
      await expect(retrying.withRetry({ count: 0 }).post<Response>('/x', null)).resolves.toEqual([OFFLINE, null]);
      await expect(retrying.post<Response>('/x', null)).resolves.toEqual([null, { token: 'd' }]);
      expect(post).toHaveBeenCalledTimes(4);
    });
  });
});

/**
 * Type-level checks, compiled by the typecheck of the spec files
 */
export function typeChecks(fetcher: ReturnType<typeof constructFetcher>) {
  // `when` gets the fetcher's error type
  fetcher.withRetry({ when: (error: FetcherError) => error instanceof HttpErrorResponse });

  // A `when` taking `unknown` does not change the result's error type
  fetcher.withRetry({ when: (_error: unknown) => true }).get<Response>('/').then(([error, response]) => {
    const typed: FetcherError | null = error;

    return error ? typed : response.token;
  });

  // @ts-expect-error `when` must accept the fetcher's error type
  fetcher.withRetry({ when: (error: string) => error.length > 0 });

  // An explicit error type flows into `when` and the results
  fetcher.withRetry<HttpErrorResponse>({ when: error => error.status === 0 }).get<Response>('/').then(([error]) => error?.status);
}
