/**
 * Matches the whole run of trailing slashes. The lookbehind makes the match start only at the first slash
 * of a run, which keeps it linear (a plain `/\/+$/` is quadratic on long runs of slashes not at the end).
 */
const TRAILING_SLASHES = /(?<!\/)\/+$/;

/**
 * Removes all trailing slashes from a URL or path
 *
 * Only the end of the string is looked at: a slash before a query string or hash (`/a/?b`) stays.
 * A string made only of slashes becomes an empty string.
 *
 * #### Example
 * ```typescript
 * import { withoutTrailingSlash } from "@telperion/js-utils/url";
 *
 * withoutTrailingSlash('https://api.example.com/'); // 'https://api.example.com'
 * withoutTrailingSlash('/docs///'); // '/docs'
 *
 * const endpoint = `${withoutTrailingSlash(process.env.API_URL)}/users`;
 * ```
 *
 * @param url - URL or path
 * @returns The URL without trailing slashes
 */
export function withoutTrailingSlash(url: string): string {
  return url.replace(TRAILING_SLASHES, '');
}
