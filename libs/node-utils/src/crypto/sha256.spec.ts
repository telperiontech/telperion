import { sha256 } from './sha256';

/** FIPS 180-2 / well-known SHA-256 vectors */
const VECTORS = {
  '': {
    hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    base64: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    base64url: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
  },
  abc: {
    hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    base64: 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
    base64url: 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0',
  },
} as const;

describe('sha256', () => {
  describe.each(Object.entries(VECTORS))('of %j', (input, expected) => {
    it('returns the 32-byte digest without an encoding', () => {
      const digest = sha256(input);

      expect(Buffer.isBuffer(digest)).toBe(true);
      expect(digest).toHaveLength(32);
      expect(digest.toString('hex')).toBe(expected.hex);
    });

    it.each(['hex', 'base64', 'base64url'] as const)('encodes the digest as %s', encoding => {
      expect(sha256(input, encoding)).toBe(expected[encoding]);
    });
  });

  it('hashes strings as UTF-8', () => {
    expect(sha256('çevik ✓', 'hex')).toBe(sha256(Buffer.from('çevik ✓', 'utf8'), 'hex'));
  });

  it('accepts a Buffer and a plain Uint8Array', () => {
    expect(sha256(Buffer.from('abc'), 'hex')).toBe(VECTORS.abc.hex);
    expect(sha256(new TextEncoder().encode('abc'), 'hex')).toBe(VECTORS.abc.hex);
  });
});
