import { safeRelativePath } from './safe-relative-path';

describe('Safe Relative Path Function', () => {
  it.each([
    '/',
    '/dashboard',
    '/settings?tab=profile',
    '/a/b/c#section',
    '/search?q=a%20b&page=2',
    '/files/a%2Fb',
    '/search?q=a%2F%2Fb',
    '/100%',
    '/discount%2550',
    '/@user',
    '/.well-known/x',
    '/ünïcödé',
    '/path/with:colon',
  ])('should accept the same-origin path %j', value => {
    expect(safeRelativePath(value)).toBe(value);
  });

  describe('open redirect payloads', () => {
    it.each([
      // absolute and protocol-relative URLs
      'https://evil.com',
      'http://evil.com/',
      '//evil.com',
      '///evil.com',
      '////evil.com',
      'evil.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      // backslashes, which browsers read as slashes
      '/\\evil.com',
      '\\\\evil.com',
      '\\/evil.com',
      '/\\/evil.com',
      '/a\\b',
      // control characters browsers strip, and header injection
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r/evil.com',
      '/\u0000/evil.com',
      '/\u007f',
      '/ok\r\nSet-Cookie: a=b',
      // percent-encoded forms
      '/%2F%2Fevil.com',
      '/%2f%2fevil.com',
      '/%2F/evil.com',
      '/%5Cevil.com',
      '/%5cevil.com',
      '/%09/evil.com',
      '/%0A/evil.com',
      '/%0d%0aSet-Cookie:%20a=b',
      '/%00',
      // double and triple encoding
      '/%252F%252Fevil.com',
      '/%25252F%25252Fevil.com',
      '/%255Cevil.com',
      // nested deeper than the decode rounds
      '/%2525252F',
      // surrounding whitespace
      ' /dashboard',
      '/dashboard\n',
      // relative paths without a leading slash
      '',
      'dashboard',
      './dashboard',
      '../dashboard',
      '?next=/x',
      '#/x',
    ])('should reject %j', value => {
      expect(safeRelativePath(value)).toBe('/');
    });
  });

  it.each([undefined, null, 42, true, {}, ['/dashboard'], new URL('https://example.com/a')])(
    'should return the fallback for the non-string value %p',
    value => {
      expect(safeRelativePath(value)).toBe('/');
    },
  );

  it('should return the given fallback', () => {
    expect(safeRelativePath('//evil.com', { fallback: '/home' })).toBe('/home');
    expect(safeRelativePath('/ok', { fallback: '/home' })).toBe('/ok');
  });

  it('should reject values longer than 2048 characters by default', () => {
    const atLimit = `/${'a'.repeat(2047)}`;

    expect(safeRelativePath(atLimit)).toBe(atLimit);
    expect(safeRelativePath(`${atLimit}a`)).toBe('/');
  });

  it('should reject values longer than the given maxLength', () => {
    expect(safeRelativePath('/abcd', { maxLength: 5 })).toBe('/abcd');
    expect(safeRelativePath('/abcde', { maxLength: 5 })).toBe('/');
  });
});
