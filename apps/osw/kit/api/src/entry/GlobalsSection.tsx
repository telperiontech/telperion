import { Code } from '@osw/react';
import { CodeBlock, CodeLine, Markdown, sideEffectImport } from '@osw/docs';
import type { DocsEntry } from '../model';

const sectionTitle = 'mt-12 text-lg font-semibold tracking-tight';

/** Globals a module declares when imported for its side effect (`declare global { var X: … }`) */
export function GlobalsSection({ entry }: { entry: DocsEntry }) {
	if (!entry.globals.length) return null;

	return (
		<section aria-labelledby="globals">
			<h2 id="globals" className={sectionTitle}>Global declarations</h2>
			<p className="mt-1 text-sm text-neutral-660">
				Import the module once, for its side effect, to declare{' '}
				{entry.globals.map((global, index) => (
					<span key={global.name}>
						{index > 0 && ', '}
						<Code code={global.name} language="ts" />
					</span>
				))}{' '}
				in the global scope.
			</p>
			<div className="mt-4">
				<CodeLine code={sideEffectImport(entry.importPath)} language="ts" />
			</div>
			<div className="mt-4 space-y-4">
				{entry.globals.map((global) => (
					<div key={global.name}>
						<CodeBlock code={global.signature} copyable={false} />
						{global.description && (
							<div className="mt-2">
								<Markdown source={global.description} labels headingTag="h4" />
							</div>
						)}
					</div>
				))}
			</div>
		</section>
	);
}
