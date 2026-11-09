import { deepFreeze } from '@telperion/js-utils/object/deep-freeze';

declare global {
  export interface ObjectConstructor {
    /**
     * #### Deep Freeze
     *
     * Recursively freezes an object and every object or function it references.
     *
     * * * *
     * Example as Object static method:
     * ```typescript
     * import "@telperion/js-utils/object/static/deep-freeze";
     *
     * const config = Object.deepFreeze({ api: { url: "https://example.com" } });
     * ```
     * * * *
     * @param object Object to freeze
     * @returns The same object, frozen
     */
    deepFreeze: typeof deepFreeze;
  }
}

Object.deepFreeze = deepFreeze;
