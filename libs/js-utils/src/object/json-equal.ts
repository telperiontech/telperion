/**
 * #### Compares two JSON-compatible values structurally
 *
 * Primitives are compared with `===`, arrays item by item in order, and plain objects
 * key by key regardless of key order. Meant for values that came from (or could go
 * through) `JSON.parse`; it is not a general-purpose deep equality:
 *
 * - `Date`, `Map`, `Set` and class instances are compared only by their own enumerable keys,
 *   so two different `Date`s are equal
 * - `NaN` is not equal to itself
 * - `{ a: undefined }` is not equal to `{}`; normalize with `JSON.parse(JSON.stringify(value))` first
 *   when such values may appear
 *
 *  * * * *
 * Example usage:
 * ```typescript
 * import { jsonEqual } from "@telperion/js-utils/object/json-equal";
 *
 * jsonEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }); // true
 * jsonEqual([1, 2], [2, 1]); // false
 * jsonEqual([1], { 0: 1 }); // false
 * ```
 * * * *
 * @param a First value
 * @param b Second value
 * @returns `true` when both values have the same JSON structure and primitives
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => jsonEqual(item, b[index]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord);

  return keys.length === Object.keys(bRecord).length && keys.every((key) => Object.hasOwn(bRecord, key) && jsonEqual(aRecord[key], bRecord[key]));
}
