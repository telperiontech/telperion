/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * #### Deep Freeze
 *
 * Recursively freezes an object and every object or function it references,
 * so nested values can't be changed either.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import { deepFreeze } from "@telperion/js-utils/object/deep-freeze";
 *
 * const config = deepFreeze({ api: { url: "https://example.com" } });
 *
 * config.api.url = "changed"; // ignored (throws in strict mode)
 * ```
 * * * *
 * @param object Object to freeze
 * @returns The same object, frozen
 */
export function deepFreeze<T extends string | number | symbol = string, U = any>(object: Record<T, U>) {
  // Retrieve the property names defined on object
  const propNames = Reflect.ownKeys(object);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = (object as any)[name];

    if ((value && typeof value === "object") || typeof value === "function") {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
}
