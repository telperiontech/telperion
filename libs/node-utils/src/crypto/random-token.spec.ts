import { randomToken } from './random-token';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe('randomToken', () => {
  it('returns 32 random bytes (256 bits) as 43 base64url characters by default', () => {
    const token = randomToken();

    expect(token).toMatch(BASE64URL);
    expect(token).toHaveLength(43);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it.each([
    [1, 2],
    [16, 22],
    [48, 64],
  ])('returns %i bytes as %i characters without padding', (bytes, length) => {
    const token = randomToken(bytes);

    expect(token).toMatch(BASE64URL);
    expect(token).toHaveLength(length);
    expect(Buffer.from(token, 'base64url')).toHaveLength(bytes);
  });

  it('returns a different token on every call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));

    expect(tokens.size).toBe(100);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('throws a RangeError for %p bytes', bytes => {
    expect(() => randomToken(bytes)).toThrow(RangeError);
  });
});
