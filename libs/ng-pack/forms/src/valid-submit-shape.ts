/** Primitive control value types a {@link ValidSubmitShape} can name. */
export type ValidSubmitPrimitive = 'string' | 'number' | 'boolean';

/**
 * What one control of a {@link ValidSubmitShape} holds:
 *
 * - `'string'`, `'number'`, `'boolean'`: a value of that `typeof`;
 * - `'string | null'`, `'number | null'`, `'boolean | null'`: the same, or `null` (e.g. an empty `<input type="number">`);
 * - `'unknown'`: anything (arrays, dates, custom control values); the value is typed `unknown`;
 * - a nested shape: an `ngModelGroup` with these controls.
 */
export type ValidSubmitShapeEntry = ValidSubmitPrimitive | `${ValidSubmitPrimitive} | null` | 'unknown' | ValidSubmitShape;

/**
 * The controls a template-driven form is expected to hold, by `name`, with the type of each value.
 * The form's value must have exactly these names: one missing or one more is a mismatch.
 *
 * @example
 * ```ts
 * const login = { email: 'string', password: 'string', remember: 'boolean' } satisfies ValidSubmitShape;
 * ```
 */
export interface ValidSubmitShape {
  readonly [name: string]: ValidSubmitShapeEntry;
}

/** The value type a {@link ValidSubmitShape} describes. */
export type ValidSubmitValue<S extends ValidSubmitShape> = {
  -readonly [K in keyof S]: ValidSubmitEntryValue<S[K]>;
};

/** The value type of one {@link ValidSubmitShapeEntry}. */
export type ValidSubmitEntryValue<E> =
  E extends 'unknown' ? unknown
  : E extends ValidSubmitPrimitive ? ValidSubmitPrimitiveValue[E]
  : E extends `${infer P extends ValidSubmitPrimitive} | null` ? ValidSubmitPrimitiveValue[P] | null
  : E extends ValidSubmitShape ? ValidSubmitValue<E>
  : never;

interface ValidSubmitPrimitiveValue {
  string: string;
  number: number;
  boolean: boolean;
}
