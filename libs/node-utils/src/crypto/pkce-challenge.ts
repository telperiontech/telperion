import { sha256 } from './sha256';

/**
 * Derives the PKCE `S256` code challenge from a code verifier (RFC 7636): base64url SHA-256 of the verifier, without padding
 *
 * The client sends the challenge with the authorization request and the verifier with the token request;
 * the authorization server derives the challenge from the verifier again and compares (e.g. with {@link safeEqual}).
 *
 * RFC 7636 requires a verifier of 43 to 128 characters from `A-Z`, `a-z`, `0-9`, `-`, `.`, `_` and `~`.
 * `randomToken(32)` to `randomToken(96)` produce such verifiers. This function does not validate the verifier.
 *
 * ```typescript
 * import { pkceChallenge, randomToken } from '@telperion/node-utils/crypto';
 *
 * const verifier = randomToken();
 * const challenge = pkceChallenge(verifier); // send with code_challenge_method=S256
 * ```
 *
 * @param verifier The code verifier
 * @returns The `S256` code challenge (43 characters)
 */
export function pkceChallenge(verifier: string): string {
  return sha256(verifier, 'base64url');
}
