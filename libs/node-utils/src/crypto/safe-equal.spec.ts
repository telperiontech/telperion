import * as nodeCrypto from 'node:crypto';

import { safeEqual } from './safe-equal';

jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof nodeCrypto>('node:crypto');

  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

describe('safeEqual', () => {
  const timingSafeEqual = jest.mocked(nodeCrypto.timingSafeEqual);

  beforeEach(() => timingSafeEqual.mockClear());

  it('returns true for equal strings', () => {
    expect(safeEqual('s3cr3t', 's3cr3t')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeEqual('s3cr3t', 's3cr3T')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(safeEqual('s3cr3t', 's3cr3t!')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });

  it('returns true for two empty values', () => {
    expect(safeEqual('', '')).toBe(true);
  });

  it('compares strings as UTF-8 and accepts bytes', () => {
    expect(safeEqual('çevik', Buffer.from('çevik', 'utf8'))).toBe(true);
    expect(safeEqual(new TextEncoder().encode('abc'), Buffer.from('abc'))).toBe(true);
    expect(safeEqual('çevik', Buffer.from('çevik', 'latin1'))).toBe(false);
  });

  it('always compares two 32-byte digests in constant time, whatever the lengths', () => {
    safeEqual('short', 'a much longer value than the other one');

    expect(timingSafeEqual).toHaveBeenCalledTimes(1);

    const [left, right] = timingSafeEqual.mock.calls[0] as [Buffer, Buffer];

    expect(left).toHaveLength(32);
    expect(right).toHaveLength(32);
  });
});
