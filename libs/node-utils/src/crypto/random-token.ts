import { randomBytes } from 'node:crypto';

/**
 * Creates an unguessable opaque token from cryptographically secure random bytes, encoded as base64url without padding
 *
 * Use it for refresh tokens, session cookies, authorization codes, OAuth/OIDC `state` and `nonce`, and PKCE code verifiers.
 * The default of 32 bytes gives 256 bits of entropy (43 characters); 16 bytes (128 bits, 22 characters) is the usual minimum.
 *
 * ```typescript
 * import { randomToken, sha256 } from '@telperion/node-utils/crypto';
 *
 * const token = randomToken(); // e.g. 'q3mX0v7...' (43 characters)
 * const stored = sha256(token, 'hex'); // keep only the hash
 *
 * randomToken(48); // 384 bits, 64 characters
 * ```
 *
 * @param bytes Number of random bytes, a positive integer (each 3 bytes become 4 characters)
 * @returns The bytes as base64url, using only `A-Z`, `a-z`, `0-9`, `-` and `_`
 * @throws RangeError when `bytes` is not a positive integer
 */
export function randomToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new RangeError(`randomToken needs a positive integer byte count, got ${bytes}`);
  }

  return randomBytes(bytes).toString('base64url');
}
