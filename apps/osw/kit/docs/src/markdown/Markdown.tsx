import { useMemo } from 'react';
import { CodeBlock } from '../code';
import { DataTable } from './DataTable';
import { Inline } from './Inline';
import { parseBlocks, type Block } from './parse-blocks';

type HeadingTag = 'h2' | 'h3' | 'h4';

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
}

function renderBlock(block: Block, key: number, previous: Block | undefined, Heading: HeadingTag) {
	switch (block.type) {
		case 'heading':
			return <Heading key={key} className="mt-6 text-sm font-semibold text-neutral-990"><Inline text={block.text} /></Heading>;
		case 'label':
			return <p key={key} className="mt-5 mb-2 text-xs font-semibold tracking-wide text-neutral-850 uppercase">{block.text.replace(/:$/, '')}</p>;
		case 'list':
			return (
				<ul key={key} className="mt-3 list-disc space-y-1 pl-5 text-neutral-920 marker:text-neutral-300">
					{block.items.map((item, index) => <li key={index}><Inline text={item} /></li>)}
				</ul>
			);
		case 'table':
			return (
				<DataTable
					key={key}
					header={block.header.map((cell) => <Inline text={cell} />)}
					rows={block.rows.map((row) => row.map((cell) => <Inline text={cell} />))}
				/>
			);
		case 'code':
			return <CodeBlock key={key} code={block.code} language={block.lang} className={previous?.type === 'label' ? 'mt-2' : 'mt-3'} />;
		default:
			return <p key={key} className="mt-3 leading-relaxed text-neutral-920"><Inline text={block.text} /></p>;
	}
}

/** Renders the small markdown subset used across the docs (see `parseBlocks`) */
export function Markdown({ source, skipIntro = false, skipLeading, labels = false, headingTag = 'h3' }: MarkdownProps) {
	const blocks = useMemo(() => {
		let parsed = parseBlocks(source, { labels });

		if (skipIntro) {
			parsed = parsed.filter((block) => !(block.type === 'heading' && block.level === 1));

			if (parsed[0]?.type === 'paragraph') parsed = parsed.slice(1);
		}

		const first = parsed[0];

		return skipLeading && first?.type === 'paragraph' && first.text === skipLeading ? parsed.slice(1) : parsed;
	}, [source, skipIntro, skipLeading, labels]);

	return <div className="text-sm">{blocks.map((block, index) => renderBlock(block, index, blocks[index - 1], headingTag))}</div>;
}
