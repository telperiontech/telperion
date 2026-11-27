/**
 * Options of {@link safeRelativePath}
 */
export interface SafeRelativePathOptions {
  /**
   * Returned when the value is not a safe relative path
   *
   * @default '/'
   */
  fallback?: string;

  /**
   * Longest accepted value, in characters
   *
   * @default 2048
   */
  maxLength?: number;
}

/**
 * How many times {@link safeRelativePath} percent-decodes a value to check it again.
 * A value that still changes after this many rounds is rejected.
 */
const MAX_DECODE_ROUNDS = 3;

/**
 * C0 control characters and DEL. Browsers drop tab and newlines from URLs (`/\t/evil.com` becomes `//evil.com`),
 * and CR/LF in a `Location` header allows header injection.
 */
function hasControlCharacters(value: string): boolean {
  return [...value].some(char => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}

/**
 * Same-origin absolute path: one leading slash, no backslash (browsers read it as a slash), no control characters
 */
function isRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !hasControlCharacters(value);
}

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    // Malformed percent sequences can't be decoded any further, by us or by anyone else
    return undefined;
  }
}

/**
 * Checks the value and each percent-decoded form of it, so code that decodes the path later
 * (once or a few times) can't turn it into an external URL
 */
function isSafeWhenDecoded(value: string, rounds: number): boolean {
  const decoded = decode(value);

  return isRelativePath(value) && (decoded === undefined || decoded === value || (rounds > 0 && isSafeWhenDecoded(decoded, rounds - 1)));
}

/**
 * #### Safe Relative Path
 *
 * Guards against open redirects: returns the value when it is a same-origin relative path
 * (e.g. a `next` or `returnTo` query parameter), the fallback otherwise.
 *
 * Accepted values start with a single `/`. Rejected:
 * - anything that is not a string, or is longer than `maxLength`
 * - absolute and protocol-relative URLs (`https://evil.com`, `//evil.com`, `javascript:…`)
 * - backslashes anywhere (`/\evil.com`, which browsers read as `//evil.com`)
 * - control characters, including tab and newlines (`/\t/evil.com`, which browsers turn into `//evil.com`)
 * - percent-encoded forms of the above (`/%2F%2Fevil.com`, `/%5Cevil.com`, `/%09/evil.com`, `/%0d%0aSet-Cookie:…`),
 *   checked after each of up to 3 rounds of decoding, for code that decodes the path before redirecting.
 *   Values that still decode further after 3 rounds are rejected too.
 *
 * Encoded slashes that stay inside the path are fine: `/files/a%2Fb` is accepted.
 * Query strings and hashes are checked like the rest of the value.
 *
 * #### Example
 * ```typescript
 * import { safeRelativePath } from "@telperion/js-utils/url";
 *
 * safeRelativePath('/settings?tab=profile'); // '/settings?tab=profile'
 * safeRelativePath('//evil.com'); // '/'
 * safeRelativePath('https://evil.com', { fallback: '/home' }); // '/home'
 *
 * router.navigateByUrl(safeRelativePath(route.queryParams['next']));
 * ```
 *
 * @param value - Untrusted redirect target
 * @param options - Fallback value and maximum length
 * @returns The value when it is a safe relative path, the fallback otherwise
 */
export function safeRelativePath(value: unknown, { fallback = '/', maxLength = 2048 }: SafeRelativePathOptions = {}): string {
  return typeof value === 'string' && value.length <= maxLength && isSafeWhenDecoded(value, MAX_DECODE_ROUNDS) ? value : fallback;
}
