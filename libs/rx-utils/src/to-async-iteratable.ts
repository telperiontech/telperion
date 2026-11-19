import type { Observable, Subscription } from "rxjs";

type Deferred<T> = [resolve: (result: IteratorResult<T, void>) => void, reject: (reason: unknown) => void];

/**
 * Creates an AsyncIterator from an Observable.
 *
 * The Observable is subscribed on the first `next()` call. Values that arrive while nobody is
 * waiting are buffered and handed out in order. Completion resolves every pending and later
 * `next()` with `done: true`, and an error rejects them. `return()`, `throw()` and
 * `Symbol.asyncDispose` (where the runtime has it) unsubscribe.
 *
 * Adapted from RxJS's own `Observable[Symbol.asyncIterator]`
 * (https://github.com/ReactiveX/rxjs/blob/master/packages/observable/src/observable.ts).
 *
 * ```ts
 * import { of } from 'rxjs';
 * import { makeAsyncIterator } from '@telperion/rx-utils/to-async-iteratable';
 *
 * const iterator = makeAsyncIterator(of(1, 2));
 *
 * await iterator.next(); // { value: 1, done: false }
 * await iterator.next(); // { value: 2, done: false }
 * await iterator.next(); // { value: undefined, done: true }
 * ```
 *
 * @param observable The Observable to convert.
 * @returns An AsyncGenerator that yields values from the Observable.
 */
export function makeAsyncIterator<T>(observable: Observable<T>): AsyncGenerator<T, void, void> {
  let subscription: Subscription | undefined;
  let hasError = false;
  let error: unknown;
  let completed = false;
  const values: T[] = [];
  const deferreds: Deferred<T>[] = [];
  const handleError = (err: unknown) => {
    hasError = true;
    error = err;

    while (deferreds.length) {
      const [, reject] = deferreds.shift()!;
      reject(err);
    }
  };
  const handleComplete = () => {
    completed = true;

    while (deferreds.length) {
      const [resolve] = deferreds.shift()!;
      resolve({ value: undefined, done: true });
    }
  };
  const iterator = {
    next(): Promise<IteratorResult<T, void>> {
      // Subscribe only once iteration starts
      subscription ??= observable.subscribe({
        next: (value) => {
          if (deferreds.length) {
            const [resolve] = deferreds.shift()!;
            resolve({ value, done: false });
          } else {
            values.push(value);
          }
        },
        error: handleError,
        complete: handleComplete,
      });

      if (values.length) return Promise.resolve({ value: values.shift()!, done: false });

      if (completed) return Promise.resolve({ value: undefined, done: true });

      if (hasError) return Promise.reject(error);

      return new Promise((resolve, reject) => {
        deferreds.push([resolve, reject]);
      });
    },
    throw(err: unknown): Promise<IteratorResult<T, void>> {
      subscription?.unsubscribe();
      // Pending `next()` promises would otherwise never settle
      handleError(err);

      return Promise.reject(err);
    },
    return(): Promise<IteratorResult<T, void>> {
      subscription?.unsubscribe();
      // Pending `next()` promises would otherwise never settle
      handleComplete();

      return Promise.resolve({ value: undefined, done: true });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as AsyncGenerator<T, void, void>;
  // Explicit resource management (`await using`) where the runtime has it; looked up dynamically so
  // older runtimes, and consumers type-checking without the `esnext.disposable` lib, still work
  const asyncDispose = (Symbol as { asyncDispose?: symbol }).asyncDispose;

  if (asyncDispose) {
    Object.defineProperty(iterator, asyncDispose, {
      value: async () => subscription?.unsubscribe(),
      configurable: true,
      writable: true,
    });
  }

  return iterator;
}

/**
 * Converts an RxJS Observable into an AsyncIterable.
 *
 * Example usage:
 * ```ts
 * import { of } from 'rxjs';
 * import { toAsyncIteratable } from '@telperion/rx-utils';
 *
 * const observable = of(1, 2, 3);
 * const asyncIterable = toAsyncIteratable(observable);
 *
 * for await (const value of asyncIterable) {
 *   console.log(value);
 * }
 * ```
 *
 * @param observable The Observable to convert.
 * @returns An AsyncIterable that yields values from the Observable.
 */
export function toAsyncIteratable<T>(observable: Observable<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return makeAsyncIterator(observable);
    }
  };
}
