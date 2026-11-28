/**
 * The files a browser loads before the first render: every local script, stylesheet and
 * modulepreload that index.html references, in order and without duplicates
 */
export function initialFiles(html: string): string[] {
  const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)]
    .map(([, ref]) => ref.split(/[?#]/)[0])
    .filter(ref => /\.(m?js|css)$/.test(ref) && !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(ref));

  return [...new Set(refs)].map(ref => ref.replace(/^\.?\//, ''));
}
