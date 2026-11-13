/** Public origin of the osw shell: every docs page is served from there, whichever remote renders it */
export const shellOrigin = (): string => (process.env['OSW_SHELL_URL'] || 'https://open-source.telperion.tr').replace(/\/+$/, '');

const escapeXml = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** A `sitemap.xml` listing `paths` (e.g. `/js-utils/array/difference`) under `origin`, deduplicated and sorted */
export function renderSitemap(origin: string, paths: Iterable<string>): string {
	const urls = [...new Set(paths)]
		.sort()
		.map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`);

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		'</urlset>',
		'',
	].join('\n');
}

/**
 * `robots.txt` of a remote's own host. Crawlers must be allowed to fetch the remote's
 * scripts to render the shell's pages, and without a real file the host's SPA rewrite
 * would answer `/robots.txt` with HTML.
 */
export const REMOTE_ROBOTS_TXT = 'User-agent: *\nAllow: /\n';
