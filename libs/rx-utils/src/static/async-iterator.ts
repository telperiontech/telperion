import { Observable } from "rxjs";

import { makeAsyncIterator } from "@telperion/rx-utils/to-async-iteratable";

declare module 'rxjs' {
  interface Observable<T> {
    /**
     * Makes every Observable usable with `for await...of`, through `makeAsyncIterator`.
     *
     * ```ts
     * import '@telperion/rx-utils/static/async-iterator';
     *
     * for await (const value of of(1, 2, 3)) console.log(value);
     * ```
     */
    [Symbol.asyncIterator](): AsyncIterator<T>;
  }
}

Observable.prototype[Symbol.asyncIterator] = function <T>(this: Observable<T>): AsyncIterator<T> {
  return makeAsyncIterator(this);
};
