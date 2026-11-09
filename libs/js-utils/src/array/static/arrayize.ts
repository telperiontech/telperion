import { arrayize } from "@telperion/js-utils/array/arrayize";

declare global {
  export interface ArrayConstructor {
    /**
     * #### Arrayize
     *
     * Wraps a non-array value in an array, and returns arrays as they are.
     *
     * * * *
     * Example as Array static method:
     * ```typescript
     * import "@telperion/js-utils/array/static/arrayize";
     *
     * Array.arrayize('foo'); // ['foo']
     * Array.arrayize(['bar']); // ['bar']
     * ```
     * * * *
     * @param value Array or single value to wrap
     */
    arrayize: typeof arrayize;
  }
}

Array.arrayize = arrayize;
