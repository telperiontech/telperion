import { useMemo } from 'react';
import { CodeBlock, Diagram } from '../code';
import { DataTable } from './DataTable';
import { headingId } from './heading-id';
import { Inline } from './Inline';
import { parseBlocks, type Block, type ListItem } from './parse-blocks';

type HeadingTag = 'h2' | 'h3' | 'h4';
type Size = 'sm' | 'base';

interface MarkdownProps {
	source: string;
	/** Drops level-1 headings and the leading paragraph, which the page already shows */
	skipIntro?: boolean;
	/** Drops a leading paragraph equal to this text (e.g. a summary shown as the page lead) */
	skipLeading?: string;
	/** Renders short `Example usage:` style paragraphs as small labels */
	labels?: boolean;
	/** Element used for headings, to fit the outline of the page around it */
	headingTag?: HeadingTag;
	/** Gives headings their GitHub-style anchor id (see `headingId`); for one document per page */
	anchors?: boolean;
	/** `sm` for doc comments inside a reference, `base` for a page of prose */
	size?: Size;
}

const styles: Record<Size, { body: string; heading: string }> = {
	sm: { body: 'text-sm', heading: 'mt-6 text-sm font-semibold text-neutral-900' },
	base: { body: 'text-[15px]', heading: 'mt-10 scroll-mt-20 text-lg font-semibold tracking-tight text-neutral-900' },
};

function ListItemView({ item }: { item: ListItem }) {
	return (
		<li>
			<Inline text={item.text} />
			{item.items.length > 0 && (
				<ul className="mt-1 list-disc space-y-1 pl-5">
					{item.items.map((text, index) => <li key={index}><Inline text={text} /></li>)}
				</ul>
			)}
		</li>
	);
}

interface RenderContext {
	Heading: HeadingTag;
	anchors: boolean;
	size: Size;
}

function renderBlock(block: Block, key: number, previous: Block | undefined, { Heading, anchors, size }: RenderContext) {
	switch (block.type) {
		case 'heading':
			return (
				<Heading key={key} id={anchors ? headingId(block.text) : undefined} className={styles[size].heading}>
					<Inline text={block.text} />
				</Heading>
			);
		case 'label':
			return <p key={key} className="mt-5 mb-2 text-xs font-semibold tracking-wide text-neutral-550 uppercase">{block.text.replace(/:$/, '')}</p>;
		case 'list': {
			const List = block.ordered ? 'ol' : 'ul';

			return (
				<List key={key} className={`mt-3 space-y-1 pl-5 text-neutral-660 marker:text-neutral-130 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
					{block.items.map((item, index) => <ListItemView key={index} item={item} />)}
				</List>
			);
		}
		case 'table':
			return (
				<DataTable
					key={key}
					header={block.header.map((cell) => <Inline text={cell} />)}
					rows={block.rows.map((row) => row.map((cell) => <Inline text={cell} />))}
				/>
			);
		case 'code':
			if (block.lang === 'mermaid') {
				return <Diagram key={key} code={block.code} className="mt-4 block rounded-lg border border-neutral-40 bg-neutral-10 p-4" />;
			}

			return <CodeBlock key={key} code={block.code} language={block.lang} className={previous?.type === 'label' ? 'mt-2' : 'mt-3'} />;
		default:
			return <p key={key} className="mt-3 leading-relaxed text-neutral-660"><Inline text={block.text} /></p>;
	}
}

/** Renders the small markdown subset used across the docs (see `parseBlocks`); `mermaid` fences become diagrams */
export function Markdown({ source, skipIntro = false, skipLeading, labels = false, headingTag = 'h3', anchors = false, size = 'sm' }: MarkdownProps) {
	const blocks = useMemo(() => {
		let parsed = parseBlocks(source, { labels });

		if (skipIntro) {
			parsed = parsed.filter((block) => !(block.type === 'heading' && block.level === 1));

			if (parsed[0]?.type === 'paragraph') parsed = parsed.slice(1);
		}

		const first = parsed[0];

		return skipLeading && first?.type === 'paragraph' && first.text === skipLeading ? parsed.slice(1) : parsed;
	}, [source, skipIntro, skipLeading, labels]);
	const context: RenderContext = { Heading: headingTag, anchors, size };

	return <div className={styles[size].body}>{blocks.map((block, index) => renderBlock(block, index, blocks[index - 1], context))}</div>;
}
