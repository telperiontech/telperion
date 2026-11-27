import { randomBytes } from 'node:crypto';

import { AesGcmCipher } from './aes-gcm-cipher';

/** Bytes 0x00…0x1f */
const FIXED_KEY = Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex');
const FIXED_PLAIN = 'refresh-token: çevik ✓';
/**
 * `FIXED_PLAIN` encrypted with `FIXED_KEY` and IV a0…ab by the original implementation this class was moved from.
 * If this stops decrypting, the stored format changed and existing values would be lost.
 */
const FIXED_VECTOR = 'v1.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw';

function replacePart(value: string, index: number, replace: (part: Buffer) => Buffer): string {
  return value
    .split('.')
    .map((part, i) => (i === index ? replace(Buffer.from(part, 'base64url')).toString('base64url') : part))
    .join('.');
}

function flipFirstBit(part: Buffer): Buffer {
  return Buffer.from(part.map((byte, i) => (i === 0 ? byte ^ 1 : byte)));
}

function decryptionError(cipher: AesGcmCipher, value: string, associatedData?: string): InstanceType<typeof AesGcmCipher.DecryptionError> {
  try {
    cipher.decrypt(value, associatedData);
  } catch (error) {
    if (error instanceof AesGcmCipher.DecryptionError) {
      return error;
    }

    throw error;
  }

  throw new Error('decrypt did not throw');
}

describe('AesGcmCipher', () => {
  const key = AesGcmCipher.generateKey();
  const cipher = new AesGcmCipher(key);

  describe('round trip', () => {
    it.each(['secret', '', 'ünïcödé ✓ 🔐', 'a'.repeat(10_000), 'with.dots.inside'])('should decrypt what it encrypted: %j', plain => {
      expect(cipher.decrypt(cipher.encrypt(plain))).toBe(plain);
    });

    it('should produce the v1 format', () => {
      expect(cipher.encrypt('secret')).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/);
    });

    it('should use a fresh IV for every value', () => {
      expect(cipher.encrypt('secret')).not.toBe(cipher.encrypt('secret'));
    });
  });

  describe('fixed vector', () => {
    it('should decrypt values written by the original implementation', () => {
      expect(new AesGcmCipher(FIXED_KEY).decrypt(FIXED_VECTOR)).toBe(FIXED_PLAIN);
    });

    it('should read the base64url form of the fixed key', () => {
      expect(AesGcmCipher.keyFromBase64Url('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')).toEqual(FIXED_KEY);
    });
  });

  describe('wrong key', () => {
    it('should throw an authentication DecryptionError', () => {
      const error = decryptionError(new AesGcmCipher(AesGcmCipher.generateKey()), cipher.encrypt('secret'));

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DecryptionError');
      expect(error.reason).toBe('authentication');
      expect(error.message).toBe('The value was not encrypted with these keys or was altered');
    });
  });

  describe('tampering', () => {
    const value = cipher.encrypt('secret value');

    it.each([
      ['iv', 1],
      ['tag', 2],
      ['ciphertext', 3],
    ])('should reject an altered %s', (_, index) => {
      expect(decryptionError(cipher, replacePart(value, index, flipFirstBit)).reason).toBe('authentication');
    });

    it('should reject a truncated tag', () => {
      expect(decryptionError(cipher, replacePart(value, 2, tag => tag.subarray(0, 12))).reason).toBe('format');
    });

    it('should reject a truncated ciphertext', () => {
      expect(decryptionError(cipher, replacePart(value, 3, data => data.subarray(1))).reason).toBe('authentication');
    });

    it('should reject swapped parts from another value', () => {
      const other = cipher.encrypt('other value').split('.');
      const mixed = value.split('.').map((part, i) => (i === 3 ? other[3] : part)).join('.');

      expect(decryptionError(cipher, mixed).reason).toBe('authentication');
    });
  });

  describe('format', () => {
    it.each([
      '',
      'v1',
      'not-encrypted',
      'v2.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw',
      'V1.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw',
      'v1.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA',
      'v1.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw.extra',
      'v1.oKGio6Slpqeo.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw',
      'v1.oKGio6Slpqeoqaqr.p2sU2tGk0F+CS0km/mD0vA.lH0aXyC4apIWCuy2aUDgHdfJL3n5l6DwDw',
      'v1.oKGio6Slpqeoqaqr.p2sU2tGk0F-CS0km-mD0vA.lH0aXyC4apIWCuy2aUDgHd fJL3n5l6DwDw',
    ])('should throw a format DecryptionError for %j', value => {
      const error = decryptionError(new AesGcmCipher(FIXED_KEY), value);

      expect(error.reason).toBe('format');
      expect(error.message).toBe('Unknown encrypted value format, expected v1.<iv>.<tag>.<ciphertext>');
    });

    it('should throw a format DecryptionError for non-string values', () => {
      expect(decryptionError(cipher, undefined as unknown as string).reason).toBe('format');
    });
  });

  describe('keys', () => {
    it.each([0, 16, 31, 33, 64])('should reject a %d-byte key', length => {
      expect(() => new AesGcmCipher(Buffer.alloc(length))).toThrow(new RangeError('AesGcmCipher needs one or more 32-byte keys'));
    });

    it('should reject an empty key list', () => {
      expect(() => new AesGcmCipher([])).toThrow(RangeError);
    });

    it('should reject a list with one bad key', () => {
      expect(() => new AesGcmCipher([key, Buffer.alloc(16)])).toThrow(RangeError);
    });

    it('should accept plain Uint8Arrays', () => {
      const plainKey = new Uint8Array(FIXED_KEY);

      expect(new AesGcmCipher(plainKey).decrypt(FIXED_VECTOR)).toBe(FIXED_PLAIN);
    });

    it('should copy the key, so changing the given buffer does not change the cipher', () => {
      const mutable = Buffer.from(FIXED_KEY.toString('hex'), 'hex');
      const fixed = new AesGcmCipher(mutable);

      mutable.fill(0);

      expect(fixed.decrypt(FIXED_VECTOR)).toBe(FIXED_PLAIN);
    });

    it('should generate random 32-byte keys', () => {
      const generated = AesGcmCipher.generateKey();

      expect(generated).toHaveLength(32);
      expect(generated).not.toEqual(AesGcmCipher.generateKey());
    });
  });

  describe('keyFromBase64Url', () => {
    it('should read a generated key back', () => {
      const generated = AesGcmCipher.generateKey();

      expect(AesGcmCipher.keyFromBase64Url(generated.toString('base64url'))).toEqual(generated);
    });

    it.each([
      ['empty', ''],
      ['too short', randomBytes(16).toString('base64url')],
      ['too long', randomBytes(33).toString('base64url')],
      ['padded', `${randomBytes(32).toString('base64url')}=`],
      ['standard base64', 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh+/'.slice(0, 43).replace('_', '/')],
      ['with spaces', ' AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'],
      ['non-canonical last character', 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh9'],
    ])('should reject a %s value', (_, value) => {
      expect(() => AesGcmCipher.keyFromBase64Url(value)).toThrow(
        new RangeError('AesGcmCipher key must be 32 bytes encoded as base64url without padding'),
      );
    });

    it('should reject a missing value', () => {
      expect(() => AesGcmCipher.keyFromBase64Url(undefined as unknown as string)).toThrow(RangeError);
    });
  });

  describe('key rotation', () => {
    const oldKey = AesGcmCipher.generateKey();
    const newKey = AesGcmCipher.generateKey();
    const before = new AesGcmCipher(oldKey);
    const rotated = new AesGcmCipher([newKey, oldKey]);

    it('should decrypt values encrypted with an older key', () => {
      expect(rotated.decrypt(before.encrypt('old secret'))).toBe('old secret');
    });

    it('should encrypt with the first key', () => {
      const value = rotated.encrypt('new secret');

      expect(new AesGcmCipher(newKey).decrypt(value)).toBe('new secret');
      expect(decryptionError(before, value).reason).toBe('authentication');
    });

    it('should reject values none of the keys opens', () => {
      expect(decryptionError(rotated, cipher.encrypt('other')).reason).toBe('authentication');
    });
  });

  describe('associated data', () => {
    it('should decrypt with the same associated data', () => {
      expect(cipher.decrypt(cipher.encrypt('secret', 'user-1'), 'user-1')).toBe('secret');
      expect(cipher.decrypt(cipher.encrypt('secret', Buffer.from([1, 2, 3])), new Uint8Array([1, 2, 3]))).toBe('secret');
    });

    it('should reject other or missing associated data', () => {
      const value = cipher.encrypt('secret', 'user-1');

      expect(decryptionError(cipher, value, 'user-2').reason).toBe('authentication');
      expect(decryptionError(cipher, value).reason).toBe('authentication');
    });

    it('should reject associated data the value was not bound to', () => {
      expect(decryptionError(cipher, cipher.encrypt('secret'), 'user-1').reason).toBe('authentication');
    });

    it('should keep values without associated data in the original format', () => {
      expect(new AesGcmCipher(FIXED_KEY).decrypt(FIXED_VECTOR, undefined)).toBe(FIXED_PLAIN);
    });
  });
});
