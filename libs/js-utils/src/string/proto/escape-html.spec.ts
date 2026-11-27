import './escape-html';

describe('Escape HTML Proto Function', () => {
  it('should escape the string', () => {
    expect('<b>"x" & \'y\'</b>'.escapeHtml()).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});
