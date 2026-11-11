import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { API_SECTION_HEADINGS, WORKSPACE_ROOT } from './config';
import { cleanText } from './text';

const REPO_URL = 'https://github.com/telperiontech/telperion';

/** Level-2 sections whose heading the generated API reference replaces */
function dropApiSections(markdown: string): string {
	const sections = markdown.split(/^(?=## )/m);

	return sections
		.filter((section) => {
			const heading = section.match(/^## +(.+)$/m)?.[1];

			return !heading || !API_SECTION_HEADINGS.includes(heading.replace(/`/g, '').trim().toLowerCase());
		})
		.join('');
}

/** Relative links (`../utils/x.ts`) point into the repo, so they become GitHub URLs */
function absolutizeLinks(markdown: string, folder: string): string {
	return markdown.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, href: string) => {
		const path = posix.normalize(posix.join(folder, href));
		const kind = /\.[a-z]+$/i.test(path) ? 'blob' : 'tree';

		return `](${REPO_URL}/${kind}/main/${path})`;
	});
}

/** The entry's README as a guide, or `undefined` when the entry has none */
export function readGuide(folder: string): string | undefined {
	const path = join(WORKSPACE_ROOT, folder, 'README.md');

	if (!existsSync(path)) return undefined;

	const guide = absolutizeLinks(dropApiSections(cleanText(readFileSync(path, 'utf8'))), folder).trim();

	return guide || undefined;
}
