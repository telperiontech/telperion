import { Icon } from '@osw/react';
import { CodeBlock } from '../code';
import { PACKAGE_NAME } from '../meta';

interface SnippetPanelProps {
	css: string;
}

const IMPORT_LINE = `import '${PACKAGE_NAME}';`;

/** The CSS behind the current preview, updated live with the controls */
export function SnippetPanel({ css }: SnippetPanelProps) {
	return (
		<section aria-labelledby="snippet-title" className="rounded-xl border border-neutral-100">
			<header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
				<h2 id="snippet-title" className="flex items-center gap-2 text-sm font-semibold">
					<Icon name="code" size={18} />
					Use it
				</h2>
			</header>
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
		</section>
	);
}
