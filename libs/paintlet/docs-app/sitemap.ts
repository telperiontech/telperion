import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitemapOptions } from '@osw/build';
// Relative: `@osw/stories/core` also exports lit renderers, which don't load in the webpack config's Node context
import { titleLeaf, toSlug } from '../../../apps/osw/kit/stories/src/core/naming';

/** Must match `BASE_PATH` in `src/Docs/routing/paths.ts` (not imported: that module pulls in React) */
const BASE_PATH = '/paintlet';
const LIBRARY_SRC = join(__dirname, '../src');

/** CSF `title` of a story file, read from source: running the module would need a browser */
const TITLE_PATTERN = /\btitle:\s*(['"`])(.+?)\1/;

const storyFiles = (dir: string = LIBRARY_SRC): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
		const path = join(dir, dirent.name);

		if (dirent.isDirectory()) return storyFiles(path);

		return dirent.name.endsWith('.stories.ts') ? [path] : [];
	});

/**
 * Home and one page per paintlet, with ids derived like the docs app's story registry
 * (`Paintlets/Low Poly Mesh` → `low-poly-mesh`). Story variants (`/paintlet/<id>/<story>`)
 * are left out: they are variations of the paintlet's page.
 */
export const sitemap: SitemapOptions = {
	paths: () => {
		const ids = storyFiles().flatMap((file) => {
			const title = TITLE_PATTERN.exec(readFileSync(file, 'utf8'))?.[2];

			return title ? [toSlug(titleLeaf(title))] : [];
		});

		return [BASE_PATH, ...ids.map((id) => `${BASE_PATH}/${id}`)];
	},
};
