import { CodeBlock, Inline, Markdown } from '@osw/docs';
import type { DocsDeclaration } from '../model';
import { TagTable } from './TagTable';

interface DeclarationDetailsProps {
	declaration: DocsDeclaration;
	/** The summary is rendered by the caller (page lead), so skip it in the body */
	summaryShown?: boolean;
}

/** Signatures, parameters, return value and the doc body of one declaration */
export function DeclarationDetails({ declaration, summaryShown = false }: DeclarationDetailsProps) {
	return (
		<>
			<div className="mt-4 space-y-2">
				{declaration.signatures.map((signature, index) => (
					<CodeBlock key={index} code={signature} copyable={false} />
				))}
			</div>

			<TagTable title="Type parameters" tags={declaration.templates} />
			<TagTable title="Parameters" tags={declaration.params} />

			{declaration.returns && (
				<div className="mt-6">
					<h3 className="text-xs font-semibold tracking-wide text-neutral-850 uppercase">Returns</h3>
					<p className="mt-2 text-sm text-neutral-920"><Inline text={declaration.returns} /></p>
				</div>
			)}

			{declaration.description && (
				<div className="mt-6">
					<Markdown source={declaration.description} labels headingTag="h4" skipLeading={summaryShown ? declaration.summary : undefined} />
				</div>
			)}
		</>
	);
}
