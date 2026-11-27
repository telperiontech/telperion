import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Why an {@link AesGcmCipher} could not decrypt a value
 *
 * - `format`: the value is not a `v1.<iv>.<tag>.<ciphertext>` string
 * - `authentication`: none of the keys (with the given associated data) opens it, or it was altered
 */
export type AesGcmDecryptionFailure = 'format' | 'authentication';

/**
 * Binary input of an {@link AesGcmCipher}: a key or associated data
 */
export type AesGcmBytes = Buffer | Uint8Array;

/**
 * Encrypts strings with AES-256-GCM, e.g. secrets stored at rest, so a database dump alone does not reveal them
 *
 * Output format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url (12-byte random IV, 16-byte auth tag).
 * The format is stable: values written by any version of this class decrypt with later versions.
 *
 * - **Key rotation**: pass several keys. `encrypt` uses the first one, `decrypt` tries each in order,
 *   so old values keep working while new ones use the new key.
 * - **Associated data**: optional data bound to the value without being stored in it (e.g. the row id).
 *   Decrypting needs the same associated data, so a value copied to another row fails to decrypt.
 *
 * ```typescript
 * import { AesGcmCipher } from '@telperion/node-utils/crypto';
 *
 * const cipher = new AesGcmCipher(AesGcmCipher.keyFromBase64Url(process.env.TOKEN_ENCRYPTION_KEY));
 *
 * const stored = cipher.encrypt(refreshToken);
 * const token = cipher.decrypt(stored);
 *
 * // Rotation: new key first, old key kept for existing values
 * const rotating = new AesGcmCipher([newKey, oldKey]);
 *
 * // Associated data
 * const bound = cipher.encrypt(refreshToken, user.id);
 * cipher.decrypt(bound, user.id);
 *
 * try {
 *   cipher.decrypt(value);
 * } catch (error) {
 *   if (error instanceof AesGcmCipher.DecryptionError) {
 *     error.reason; // 'format' | 'authentication'
 *   }
 * }
 * ```
 */
export class AesGcmCipher {
  /**
   * Key length in bytes (AES-256)
   */
  static readonly KEY_LENGTH = 32;

  /**
   * Thrown by {@link AesGcmCipher.decrypt} when a value has an unknown format,
   * was not encrypted with any of the keys (or with other associated data), or was altered
   */
  static readonly DecryptionError = class DecryptionError extends Error {
    override readonly name = 'DecryptionError';

    /**
     * @param reason Why the value could not be decrypted
     * @param message Error message
     * @param options Error options, e.g. the underlying `cause`
     */
    constructor(readonly reason: AesGcmDecryptionFailure, message: string, options?: ErrorOptions) {
      super(message, options);
    }
  };

  static readonly #VERSION = 'v1';
  static readonly #ALGORITHM = 'aes-256-gcm';
  static readonly #IV_LENGTH = 12;
  static readonly #TAG_LENGTH = 16;
  static readonly #BASE64URL = /^[A-Za-z0-9_-]*$/;

  /**
   * Reads a key from its base64url form (e.g. an environment variable), as produced by
   * `AesGcmCipher.generateKey().toString('base64url')`
   *
   * @param value 32 bytes, base64url encoded without padding (43 characters)
   * @throws RangeError when the value is not base64url or does not hold exactly 32 bytes
   */
  static keyFromBase64Url(value: string): Buffer {
    const key = typeof value === 'string' && AesGcmCipher.#BASE64URL.test(value) ? Buffer.from(value, 'base64url') : undefined;

    if (!key || key.length !== AesGcmCipher.KEY_LENGTH || key.toString('base64url') !== value) {
      throw new RangeError(`AesGcmCipher key must be ${AesGcmCipher.KEY_LENGTH} bytes encoded as base64url without padding`);
    }

    return key;
  }

  /**
   * Creates a random 32-byte key
   */
  static generateKey(): Buffer {
    return randomBytes(AesGcmCipher.KEY_LENGTH);
  }

  readonly #keys: readonly Buffer[];

  /**
   * @param keys A 32-byte key, or several for rotation: the first one encrypts, all of them decrypt
   * @throws RangeError when no key is given or a key is not 32 bytes long
   */
  constructor(keys: AesGcmBytes | readonly AesGcmBytes[]) {
    const list: readonly AesGcmBytes[] = keys instanceof Uint8Array ? [keys] : keys;
    const invalid = list.findIndex(key => !(key instanceof Uint8Array) || key.length !== AesGcmCipher.KEY_LENGTH);

    if (list.length === 0 || invalid !== -1) {
      throw new RangeError(`AesGcmCipher needs one or more ${AesGcmCipher.KEY_LENGTH}-byte keys`);
    }

    this.#keys = list.map(key => Buffer.from(key));
  }

  /**
   * Encrypts a string with the first key and a random IV
   *
   * @param plain Text to encrypt
   * @param associatedData Data the value is bound to; `decrypt` needs the same
   * @returns `v1.<iv>.<tag>.<ciphertext>`
   */
  encrypt(plain: string, associatedData?: string | AesGcmBytes): string {
    const iv = randomBytes(AesGcmCipher.#IV_LENGTH);
    const cipher = createCipheriv(AesGcmCipher.#ALGORITHM, this.#keys[0], iv, { authTagLength: AesGcmCipher.#TAG_LENGTH });

    if (associatedData !== undefined) {
      cipher.setAAD(Buffer.from(associatedData));
    }

    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    return [AesGcmCipher.#VERSION, ...[iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url'))].join('.');
  }

  /**
   * Decrypts a value produced by {@link AesGcmCipher.encrypt}, trying each key in order
   *
   * @param value `v1.<iv>.<tag>.<ciphertext>`
   * @param associatedData The associated data given to `encrypt`, if any
   * @returns The plain text
   * @throws AesGcmCipher.DecryptionError when the format is unknown, no key opens the value, or it was altered
   */
  decrypt(value: string, associatedData?: string | AesGcmBytes): string {
    const parts = AesGcmCipher.#parse(value);
    const plain = this.#keys.reduce<string | undefined>(
      (found, key) => found ?? AesGcmCipher.#open(key, parts, associatedData),
      undefined,
    );

    if (plain === undefined) {
      throw new AesGcmCipher.DecryptionError('authentication', 'The value was not encrypted with these keys or was altered');
    }

    return plain;
  }

  static #parse(value: string): { iv: Buffer; tag: Buffer; encrypted: Buffer } {
    const [version, ...encoded] = typeof value === 'string' ? value.split('.') : [];
    const [iv, tag, encrypted] = encoded.every(part => AesGcmCipher.#BASE64URL.test(part))
      ? encoded.map(part => Buffer.from(part, 'base64url'))
      : [];

    if (
      version !== AesGcmCipher.#VERSION ||
      encoded.length !== 3 ||
      iv?.length !== AesGcmCipher.#IV_LENGTH ||
      tag?.length !== AesGcmCipher.#TAG_LENGTH ||
      !encrypted
    ) {
      throw new AesGcmCipher.DecryptionError('format', 'Unknown encrypted value format, expected v1.<iv>.<tag>.<ciphertext>');
    }

    return { iv, tag, encrypted };
  }

  /**
   * Decrypts with one key, `undefined` when the key (or associated data) does not match or the value was altered
   */
  static #open(key: Buffer, { iv, tag, encrypted }: { iv: Buffer; tag: Buffer; encrypted: Buffer }, associatedData?: string | AesGcmBytes): string | undefined {
    try {
      const decipher = createDecipheriv(AesGcmCipher.#ALGORITHM, key, iv, { authTagLength: AesGcmCipher.#TAG_LENGTH });

      decipher.setAuthTag(tag);

      if (associatedData !== undefined) {
        decipher.setAAD(Buffer.from(associatedData));
      }

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      return undefined;
    }
  }
}
