import type { MonoTypeOperatorFunction } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

/**
 * Shares one subscription to the source and replays its last value to every new subscriber.
 *
 * The source is subscribed on the first subscription and is never unsubscribed, even when every
 * subscriber has left: equivalent to `shareReplay({ refCount: false, bufferSize: 1 })`. Use it for
 * long-lived, cache-like streams; prefer `shareReplay({ refCount: true, bufferSize: 1 })` when the
 * source should stop once nobody listens.
 *
 * @example
 * ```ts
 * import { interval, take } from 'rxjs';
 * import { shareLast } from '@telperion/rx-utils/operators';
 *
 * const ticks = interval(1000).pipe(take(5), shareLast());
 *
 * ticks.subscribe((tick) => console.log('A', tick));
 * setTimeout(() => ticks.subscribe((tick) => console.log('B', tick)), 2500); // B starts with 1
 * ```
 *
 * @returns An operator that multicasts the source and replays its latest value
 */
export function shareLast<T>(): MonoTypeOperatorFunction<T> {
  return shareReplay({ refCount: false, bufferSize: 1 });
}
