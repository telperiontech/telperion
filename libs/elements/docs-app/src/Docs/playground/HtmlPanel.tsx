import { CodeBlock, Panel, sideEffectImport } from '@osw/docs';
import { model, type EntryDoc } from '../model';

interface HtmlPanelProps {
	entry: EntryDoc;
	html: string;
}

/** How to load the entry, plus the markup of the current story setup */
export function HtmlPanel({ entry, html }: HtmlPanelProps) {
	return (
		<Panel id="html" icon="code" title="Use it">
			<div className="space-y-3 p-4">
				<div>
					<p className="mb-1.5 text-xs font-medium text-neutral-850">1. Load the element (bundler, or the CDN build)</p>
					<CodeBlock code={sideEffectImport(entry.importPath)} language="ts" />
					<CodeBlock code={`<script src="${model.cdnUrl}"></script>`} language="html" className="mt-2" />
				</div>
				<div>
					<p className="mb-1.5 text-xs font-medium text-neutral-850">2. Copy the markup for this exact setup</p>
					<CodeBlock code={html || '<!-- This story renders imperatively; see its source -->'} language="html" />
				</div>
			</div>
		</Panel>
	);
}
