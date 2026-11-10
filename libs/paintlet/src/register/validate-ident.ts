const IDENT = /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/;
const DASHED_IDENT = /^--[a-zA-Z0-9_-]+$/;

/**
 * Throws if `value` is not a plain CSS identifier.
 * Guards every name that is interpolated into generated CSS or JS source.
 */
export function assertIdent(value: string, label: string): void {
  if (!IDENT.test(value)) {
    throw new TypeError(`Invalid ${label} "${value}": expected a CSS identifier.`);
  }
}

/**
 * Throws if `value` is not a custom property name (`--foo`).
 */
export function assertDashedIdent(value: string, label: string): void {
  if (!DASHED_IDENT.test(value)) {
    throw new TypeError(`Invalid ${label} "${value}": expected a custom property name (--*).`);
  }
}
