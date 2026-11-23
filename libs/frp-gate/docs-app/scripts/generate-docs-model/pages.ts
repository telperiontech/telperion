import type { NavGroup, Page, PageKind } from '../../src/model/types';
import { BASE_PATH } from '../../src/Docs/base-path';
import { rewriteMarkdown, summaryOf, withoutFirstTable, type LinkContext, type Readme, type Section } from './readme';

/** README sections whose table is replaced by a reference generated from Go */
const GENERATED_TABLES: Record<string, PageKind> = { configuration: 'env', 'json-api': 'api' };
/** Reference pages with no README section: the body comes from Go, the intro is written here */
const EXTRA_PAGES: Omit<Page, 'summary' | 'headings'>[] = [
	{
		slug: 'cli',
		title: 'Command line',
		kind: 'cli',
		markdown: `The image runs \`frp-gate\` without a command, which starts the server. \`apply\`, \`export\` and \`backup\` open the same database (\`FRP_GATE_DB\`), so run them in the server's container: \`docker exec frp-gate frp-gate apply --dry-run\`.`,
	},
	{
		slug: 'config-file',
		title: 'Config file',
		kind: 'config-file',
		markdown: `Every key of the YAML file that frp-gate applies at every start (\`FRP_GATE_CONFIG\`) and with \`frp-gate apply\`. Unknown keys are errors, and so is an empty file. How it is applied and who owns what: [Declarative config](${BASE_PATH}/declarative-config).`,
	},
	{
		slug: 'examples',
		title: 'Examples',
		kind: 'examples',
		markdown: `A complete gateway: Caddy, frps from docker-frp and frp-gate. Copy the folder to the server and follow the [Quick start](${BASE_PATH}/quick-start).`,
	},
];
const REFERENCE_ORDER = ['configuration', 'json-api', 'cli', 'config-file'];

export const pagePath = (slug: string) => `${BASE_PATH}/${slug}`;

/** Section and subsection anchors of the README → docs routes */
export function anchorRoutes(sections: Section[]): Map<string, string> {
	return new Map(
		sections.flatMap(({ slug, headings }) => [[slug, pagePath(slug)] as const, ...headings.map(({ id }) => [id, `${pagePath(slug)}#${id}`] as const)]),
	);
}

/** One page per README section plus the generated references, and the sidebar groups */
export function buildPages({ sections }: Readme, links: LinkContext): { pages: Page[]; nav: NavGroup[] } {
	const readmePages: Page[] = sections.map(({ slug, title, body, headings }) => {
		const kind = GENERATED_TABLES[slug] ?? 'guide';
		const markdown = rewriteMarkdown(kind === 'guide' ? body : withoutFirstTable(body), links);

		return { slug, title, kind, markdown, summary: summaryOf(markdown), headings };
	});
	const pages = [...readmePages, ...EXTRA_PAGES.map((page) => ({ ...page, summary: summaryOf(page.markdown), headings: [] }))];
	const guide = readmePages.filter((page) => page.kind === 'guide').map((page) => page.slug);

	return {
		pages,
		nav: [
			{ title: 'Guide', slugs: guide },
			{ title: 'Reference', slugs: REFERENCE_ORDER },
			{ title: 'Examples', slugs: ['examples'] },
		],
	};
}
