import { createHash } from 'node:crypto';

/**
 * Input of {@link sha256}: text (hashed as UTF-8) or bytes
 */
export type Sha256Input = string | Buffer | Uint8Array;

/**
 * Text encodings {@link sha256} can return the digest in
 */
export type Sha256Encoding = 'hex' | 'base64' | 'base64url';

/**
 * Hashes a value with SHA-256
 *
 * Typical use: store only the hash of an opaque token (refresh token, session id, authorization code),
 * so a database dump alone does not reveal usable tokens. Look a token up by hashing what the client sends.
 * This is for high-entropy values such as {@link randomToken} output, not for passwords: use a slow
 * password hash (scrypt, argon2) for those.
 *
 * ```typescript
 * import { sha256 } from '@telperion/node-utils/crypto';
 *
 * sha256('abc'); // <Buffer ba 78 16 bf ...> (32 bytes)
 * sha256('abc', 'hex'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 * sha256(refreshToken, 'base64url'); // 43 characters, no padding
 * ```
 *
 * @param value Text (hashed as UTF-8) or bytes
 * @returns The 32-byte digest
 */
export function sha256(value: Sha256Input): Buffer;
/**
 * @param value Text (hashed as UTF-8) or bytes
 * @param encoding Encoding of the returned digest (`base64url` has no padding)
 * @returns The digest as text
 */
export function sha256(value: Sha256Input, encoding: Sha256Encoding): string;
export function sha256(value: Sha256Input, encoding?: Sha256Encoding): Buffer | string {
  const digest = createHash('sha256').update(value).digest();

  return encoding ? digest.toString(encoding) : digest;
}
