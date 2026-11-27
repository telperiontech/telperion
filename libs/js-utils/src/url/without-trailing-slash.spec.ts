import { withoutTrailingSlash } from './without-trailing-slash';

describe('Without Trailing Slash Function', () => {
  it.each([
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://api.example.com///', 'https://api.example.com'],
    ['https://api.example.com', 'https://api.example.com'],
    ['/docs/', '/docs'],
    ['a/b/c//', 'a/b/c'],
    ['/a//b/', '/a//b'],
    ['/a/?b', '/a/?b'],
    ['/', ''],
    ['///', ''],
    ['', ''],
  ])('should turn %j into %j', (url, expected) => {
    expect(withoutTrailingSlash(url)).toBe(expected);
  });

  it('should stay fast on long runs of slashes that are not at the end', () => {
    const url = `${'/'.repeat(100_000)}x`;
    const start = Date.now();

    expect(withoutTrailingSlash(url)).toBe(url);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
