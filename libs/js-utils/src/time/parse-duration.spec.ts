import { parseDuration } from './parse-duration';

describe('Parse Duration Function', () => {
  it.each([
    ['250ms', 250],
    ['1s', 1_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
    ['2w', 1_209_600_000],
  ])('should parse %s into %d milliseconds', (value, expected) => {
    expect(parseDuration(value)).toBe(expected);
  });

  it('should parse zero', () => {
    expect(parseDuration('0s')).toBe(0);
  });

  it('should accept leading zeros', () => {
    expect(parseDuration('05m')).toBe(300_000);
  });

  it.each([' 15m', '15m ', '\t15m\n', '  15m  '])('should ignore surrounding whitespace in %j', value => {
    expect(parseDuration(value)).toBe(900_000);
  });

  it.each([
    '',
    '   ',
    '10',
    'm',
    '10x',
    '-5m',
    '+5m',
    '1.5h',
    '.5h',
    '1e3s',
    '15 m',
    '15M',
    '15mm',
    '15min',
    '1y',
    '1mo',
    '15m30s',
    '0x10s',
    '99999999999w',
  ])('should throw for %j', value => {
    expect(() => parseDuration(value)).toThrow(`Invalid duration ${JSON.stringify(value)}`);
  });

  it('should explain the expected format', () => {
    expect(() => parseDuration('10x')).toThrow('expected a whole number followed by ms, s, m, h, d or w (e.g. 15m or 30d)');
  });

  it.each([undefined, null, 15, {}])('should throw a clear error for the non-string value %p', value => {
    expect(() => parseDuration(value as unknown as string)).toThrow(`Invalid duration (${typeof value})`);
  });
});
