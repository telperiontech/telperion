import { timingSafeEqual } from 'node:crypto';

import { sha256, type Sha256Input } from './sha256';

/**
 * Compares two secrets in constant time, without revealing their lengths
 *
 * Use it wherever one side is a secret an attacker could guess byte by byte through response times:
 * client secrets, PKCE verifiers against stored challenges, API keys, HMAC signatures.
 *
 * Both values are hashed with SHA-256 first and the digests compared with `timingSafeEqual`, so the
 * comparison always runs over 32 bytes and a length mismatch does not return early.
 * Strings are compared as UTF-8.
 *
 * ```typescript
 * import { safeEqual } from '@telperion/node-utils/crypto';
 *
 * if (!safeEqual(presentedSecret, client.clientSecret)) {
 *   throw new UnauthorizedException();
 * }
 * ```
 *
 * @param a One value
 * @param b The other value
 * @returns Whether both values are byte for byte equal
 */
export function safeEqual(a: Sha256Input, b: Sha256Input): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}
