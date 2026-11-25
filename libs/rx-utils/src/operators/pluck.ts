import type { PathValue } from '@telperion/extra-ts-types';
import { map, type OperatorFunction } from 'rxjs';

/** Keys of the value at a path, skipping `null` and `undefined` the way `?.` does */
type KeyAt<T, P extends readonly PropertyKey[]> = keyof NonNullable<PathValue<T, P>>;

/**
 * Emits the value found by following `keys` into each source value: `pluck('a', 'b')` emits
 * `value?.a?.b`.
 *
 * A typed replacement for the deprecated RxJS `pluck`. Every key is checked against the value at
 * that point, and the emitted type is `PathValue<T, typeof keys>`
 * from `@telperion/extra-ts-types`. When a link on the way is `null` or `undefined`, the operator
 * emits `undefined` and the emitted type includes it. Up to six keys are supported.
 *
 * @example
 * ```ts
 * import { of } from 'rxjs';
 * import { pluck } from '@telperion/rx-utils/operators';
 *
 * of({ user: { name: { first: 'Ada', last: 'Lovelace' } } })
 *   .pipe(pluck('user', 'name', 'first'))
 *   .subscribe(console.log); // 'Ada', typed as string
 *
 * of<{ team?: { lead: string } }>({})
 *   .pipe(pluck('team', 'lead'))
 *   .subscribe(console.log); // undefined, typed as string | undefined
 * ```
 *
 * @param keys - The keys to follow, outermost first
 * @returns An operator that maps each source value to the value at the path
 */
export function pluck<T, K1 extends KeyAt<T, []>>(k1: K1): OperatorFunction<T, PathValue<T, [K1]>>;
export function pluck<T, K1 extends KeyAt<T, []>, K2 extends KeyAt<T, [K1]>>(k1: K1, k2: K2): OperatorFunction<T, PathValue<T, [K1, K2]>>;
export function pluck<T, K1 extends KeyAt<T, []>, K2 extends KeyAt<T, [K1]>, K3 extends KeyAt<T, [K1, K2]>>(
  k1: K1,
  k2: K2,
  k3: K3,
): OperatorFunction<T, PathValue<T, [K1, K2, K3]>>;
export function pluck<
  T,
  K1 extends KeyAt<T, []>,
  K2 extends KeyAt<T, [K1]>,
  K3 extends KeyAt<T, [K1, K2]>,
  K4 extends KeyAt<T, [K1, K2, K3]>,
>(k1: K1, k2: K2, k3: K3, k4: K4): OperatorFunction<T, PathValue<T, [K1, K2, K3, K4]>>;
export function pluck<
  T,
  K1 extends KeyAt<T, []>,
  K2 extends KeyAt<T, [K1]>,
  K3 extends KeyAt<T, [K1, K2]>,
  K4 extends KeyAt<T, [K1, K2, K3]>,
  K5 extends KeyAt<T, [K1, K2, K3, K4]>,
>(k1: K1, k2: K2, k3: K3, k4: K4, k5: K5): OperatorFunction<T, PathValue<T, [K1, K2, K3, K4, K5]>>;
export function pluck<
  T,
  K1 extends KeyAt<T, []>,
  K2 extends KeyAt<T, [K1]>,
  K3 extends KeyAt<T, [K1, K2]>,
  K4 extends KeyAt<T, [K1, K2, K3]>,
  K5 extends KeyAt<T, [K1, K2, K3, K4]>,
  K6 extends KeyAt<T, [K1, K2, K3, K4, K5]>,
>(k1: K1, k2: K2, k3: K3, k4: K4, k5: K5, k6: K6): OperatorFunction<T, PathValue<T, [K1, K2, K3, K4, K5, K6]>>;
export function pluck(...keys: PropertyKey[]): OperatorFunction<unknown, unknown> {
  return map((value) => keys.reduce<unknown>((current, key) => (current == null ? undefined : (current as Record<PropertyKey, unknown>)[key]), value));
}
