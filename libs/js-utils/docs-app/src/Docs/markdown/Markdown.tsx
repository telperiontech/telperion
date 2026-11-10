import { useMemo } from 'react';
import { CodeBlock } from './CodeBlock';
import { Inline } from './Inline';
import { parseBlocks, type Block } from './parse-blocks';

function renderBlock(block: Block, key: number) {
	switch (block.type) {
		case 'heading':
			return <h4 key={key} className="mt-6 text-sm font-semibold text-neutral-990"><Inline text={block.text} /></h4>;
		case 'label':
			return <p key={key} className="mt-5 mb-2 text-xs font-semibold tracking-wide text-neutral-850 uppercase">{block.text.replace(/:$/, '')}</p>;
		case 'list':
			return (
				<ul key={key} className="mt-3 list-disc space-y-1 pl-5 text-neutral-920 marker:text-neutral-300">
					{block.items.map((item, index) => <li key={index}><Inline text={item} /></li>)}
				</ul>
			);
		case 'code':
			return <CodeBlock key={key} code={block.code} className="mt-2" />;
		default:
			return <p key={key} className="mt-3 leading-relaxed text-neutral-920"><Inline text={block.text} /></p>;
	}
}

interface MarkdownProps {
	source: string;
	/** Drops a leading paragraph already shown elsewhere (the entry summary) */
	skipLeading?: string;
}

export function Markdown({ source, skipLeading }: MarkdownProps) {
	const blocks = useMemo(() => {
		const parsed = parseBlocks(source);
		const first = parsed[0];
		return first?.type === 'paragraph' && first.text === skipLeading ? parsed.slice(1) : parsed;
	}, [source, skipLeading]);

	return <div className="text-sm">{blocks.map(renderBlock)}</div>;
}
