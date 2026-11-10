import { useMemo } from 'react';
import { CodeBlock, toLanguage } from '../code';
import { Inline } from './Inline';
import { parseBlocks, type Block } from './parse-blocks';

function Table({ header, rows }: { header: string[]; rows: string[][] }) {
	return (
		<div className="mt-3 overflow-x-auto rounded-lg border border-neutral-100">
			<table className="w-full text-left text-[13px]">
				<thead className="bg-neutral-20 text-xs text-neutral-850">
					<tr>{header.map((cell, index) => <th key={index} className="px-3 py-2 font-semibold"><Inline text={cell} /></th>)}</tr>
				</thead>
				<tbody className="divide-y divide-neutral-100">
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, index) => <td key={index} className="px-3 py-2 align-top text-neutral-920"><Inline text={cell} /></td>)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function renderBlock(block: Block, key: number) {
	switch (block.type) {
		case 'heading':
			return <h3 key={key} className="mt-6 text-sm font-semibold text-neutral-990"><Inline text={block.text} /></h3>;
		case 'list':
			return (
				<ul key={key} className="mt-3 list-disc space-y-1 pl-5 text-neutral-920 marker:text-neutral-300">
					{block.items.map((item, index) => <li key={index}><Inline text={item} /></li>)}
				</ul>
			);
		case 'table':
			return <Table key={key} header={block.header} rows={block.rows} />;
		case 'code':
			return <CodeBlock key={key} code={block.code} language={toLanguage(block.lang)} className="mt-3" />;
		default:
			return <p key={key} className="mt-3 leading-relaxed text-neutral-920"><Inline text={block.text} /></p>;
	}
}

interface MarkdownProps {
	source: string;
	/** Drops level-1 headings and the leading paragraph, which the page already shows */
	skipIntro?: boolean;
}

export function Markdown({ source, skipIntro = false }: MarkdownProps) {
	const blocks = useMemo(() => {
		const parsed = parseBlocks(source);

		if (!skipIntro) return parsed;

		const withoutTitle = parsed.filter((block) => !(block.type === 'heading' && block.level === 1));

		return withoutTitle[0]?.type === 'paragraph' ? withoutTitle.slice(1) : withoutTitle;
	}, [source, skipIntro]);

	return <div className="text-sm">{blocks.map(renderBlock)}</div>;
}
