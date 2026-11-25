import { map, type OperatorFunction } from 'rxjs';

/**
 * Maps every source value to the same constant: shorthand for `map(() => value)`.
 *
 * A typed, non-deprecated replacement for RxJS's `mapTo`. The value is not copied, so every
 * emission is the same reference; use `map(() => ({ ... }))` when each one needs a fresh object.
 *
 * @example
 * ```ts
 * import { fromEvent } from 'rxjs';
 * import { mapTo } from '@telperion/rx-utils/operators';
 *
 * const clicked$ = fromEvent(button, 'click').pipe(mapTo(true));
 * ```
 *
 * @param value - The value to emit for every source value
 * @returns An operator that emits `value` each time the source emits
 */
export function mapTo<R>(value: R): OperatorFunction<unknown, R> {
  return map(() => value);
}
