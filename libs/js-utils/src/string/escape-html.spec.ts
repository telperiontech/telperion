import { escapeHtml } from './escape-html';

describe('Escape HTML Function', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('should escape %s as %s', (char, escaped) => {
    expect(escapeHtml(char)).toBe(escaped);
  });

  it('should escape every occurrence', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });

  it('should escape the ampersand of an existing entity again', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('should leave plain text unchanged', () => {
    expect(escapeHtml('Hello, wörld ✓ 1 + 1 = 2')).toBe('Hello, wörld ✓ 1 + 1 = 2');
    expect(escapeHtml('')).toBe('');
  });
});
