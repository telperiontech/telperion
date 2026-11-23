import { existsSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
// Relative: plain `node -r @swc-node/register` does not apply tsconfig paths
import { headingId } from '../../../../../apps/osw/kit/docs/src/markdown/heading-id';
import { exampleId } from '../../src/model/ids';

/** One `##` section of the README, with its `###` subsections */
export interface Section {
	title: string;
	slug: string;
	/** Markdown below the `##` heading */
	body: string;
	/** `###` headings in the body */
	headings: { id: string; text: string }[];
}

export interface Readme {
	/** Text between the title and the first section, without badges */
	intro: string;
	sections: Section[];
}

/** Sections that are not about using frp-gate: the table of contents and how to work on it */
const SKIPPED = new Set(['contents', 'development', 'license']);
/** Fence languages Shiki has no grammar for, rendered as plain text instead */
const PLAIN_FENCES = new Set(['caddyfile']);

export function parseReadme(markdown: string): Readme {
	const [head, ...rest] = markdown.replace(/\r\n/g, '\n').split(/^## /m);
	const intro = head
		.replace(/^# .*\n/, '')
		.split('\n')
		.filter((line) => !line.startsWith('[!['))
		.join('\n')
		.trim();
	const sections = rest
		.map((chunk) => {
			const [titleLine, ...lines] = chunk.split('\n');
			const title = titleLine.trim();
			const body = lines.join('\n').trim();
			const headings = [...body.matchAll(/^### (.+)$/gm)].map(([, text]) => ({ id: headingId(text), text }));

			return { title, slug: headingId(title), body, headings };
		})
		.filter((section) => !SKIPPED.has(section.slug));

	return { intro, sections };
}

export interface LinkContext {
	/** Workspace-relative library folder, e.g. `libs/frp-gate` */
	libRoot: string;
	workspaceRoot: string;
	/** Heading id (section or subsection) → docs route */
	anchors: Map<string, string>;
	examplesPath: string;
	repoUrl: string;
	/** Collects links that cannot be resolved */
	problems: string[];
}

/** Applies `transform` to the prose of `markdown`, leaving fenced code alone */
function outsideFences(markdown: string, transform: (prose: string) => string): string {
	return markdown
		.split(/(^```[\s\S]*?^```)/m)
		.map((part, index) => (index % 2 ? part : transform(part)))
		.join('');
}

/**
 * Prepares README markdown for the docs: drops references to the design notes (they are for
 * people working on frp-gate), points section anchors and `examples/` at docs routes and
 * other relative paths at GitHub.
 */
export function rewriteMarkdown(markdown: string, context: LinkContext): string {
	const withPlainFences = markdown.replace(/^```(\w+)/gm, (fence, language: string) => (PLAIN_FENCES.has(language) ? '```text' : fence));

	return outsideFences(withPlainFences, (prose) =>
		prose
			// `(see [DESIGN.md](DESIGN.md#x))` and `; see [DESIGN.md](DESIGN.md#x)`
			.replace(/\s*\(see\s+\[[^\]]*\]\(DESIGN\.md[^)]*\)\)/g, '')
			.replace(/[;,]\s*see\s+\[[^\]]*\]\(DESIGN\.md[^)]*\)/g, '')
			.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (link, label: string, href: string) => {
				const target = resolveLink(href, context);

				if (target === undefined) {
					context.problems.push(`README link to "${href}" (${label}) does not resolve`);

					return label;
				}

				return `[${label}](${target})`;
			}),
	);
}

function resolveLink(href: string, { libRoot, workspaceRoot, anchors, examplesPath, repoUrl }: LinkContext): string | undefined {
	if (/^https?:/.test(href)) return href;

	if (href.startsWith('#')) return anchors.get(href.slice(1));

	const [path] = href.split('#');

	if (path === 'DESIGN.md') return undefined;

	if (path === 'examples' || path.startsWith('examples/')) {
		const file = path.slice('examples/'.length);

		return file ? `${examplesPath}#${exampleId(file)}` : examplesPath;
	}

	const workspacePath = posix.normalize(posix.join(libRoot, path));
	const absolute = join(workspaceRoot, workspacePath);

	if (!existsSync(absolute)) return undefined;

	return `${repoUrl}/${statSync(absolute).isDirectory() ? 'tree' : 'blob'}/main/${workspacePath}`;
}

/** Drops the first pipe table of `markdown` (replaced by a table generated from Go) */
export function withoutFirstTable(markdown: string): string {
	return markdown.replace(/^\|.*\|\n(?:\|.*\|\n?)+/m, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Rows of the first pipe table of `markdown`, without the header */
export function firstTable(markdown: string): string[][] {
	const table = /^\|.*\|\n(?:\|.*\|\n?)+/m.exec(markdown)?.[0] ?? '';

	return table
		.trim()
		.split('\n')
		.slice(2)
		.map((row) =>
			row
				.replace(/^\||\|$/g, '')
				.split('|')
				.map((cell) => cell.trim()),
		);
}

/** First sentence of the first paragraph, as plain text */
export function summaryOf(markdown: string): string {
	const paragraph = markdown
		.replace(/^```[\s\S]*?^```/gm, '')
		.split(/\n\s*\n/)
		.map((block) => block.trim())
		.find((block) => block && !/^(```|\||#|[-*] |\d+\. )/.test(block)) ?? '';
	const plain = paragraph
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\s+/g, ' ');

	return plain.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? plain;
}
