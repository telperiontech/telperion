import { CodeBlock, Panel } from '@osw/docs';
import { PACKAGE_NAME } from '../meta';

interface SnippetPanelProps {
	css: string;
}

const IMPORT_LINE = `import '${PACKAGE_NAME}';`;

/** The CSS behind the current preview, updated live with the controls */
export function SnippetPanel({ css }: SnippetPanelProps) {
	return (
		<Panel id="snippet" icon="code" title="Use it">
			<div className="space-y-3 p-4">
				<div>
					<p className="mb-1.5 text-xs font-medium text-neutral-850">1. Register the paintlets once</p>
					<CodeBlock code={IMPORT_LINE} language="ts" />
				</div>
				<div>
					<p className="mb-1.5 text-xs font-medium text-neutral-850">2. Copy the CSS for this exact setup</p>
					<CodeBlock code={css || '/* Rendering… */'} language="css" />
				</div>
			</div>
		</Panel>
	);
}
