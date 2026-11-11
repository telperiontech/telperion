import { ExternalLink } from '@osw/react';
import { CodeBlock, ImportLine, Markdown, sideEffectImport } from '@osw/docs';
import type { DocsExtension } from '../model';
import { sourceUrl } from '../routing';
import { KindBadge } from './KindBadge';

const usageName = (extension: DocsExtension, member: string) =>
	extension.kind === 'prototype' ? `${extension.target}.prototype.${member}` : `${extension.target}.${member}`;

/** A `proto/` or `static/` module that installs the entry's function on a global */
export function ExtensionSection({ extension }: { extension: DocsExtension }) {
	return (
		<article className="rounded-xl border border-neutral-100 p-5">
			<header className="flex flex-wrap items-center gap-2">
				<h3 className="font-mono text-sm font-semibold">
					{extension.members.map((member) => usageName(extension, member)).join(', ')}
				</h3>
				<KindBadge kind={extension.kind} />
				<ExternalLink href={sourceUrl(extension.sourcePath)} className="ml-auto text-xs font-medium text-neutral-850 hover:text-secondary-800">
					Source
				</ExternalLink>
			</header>

			<div className="mt-3">
				<ImportLine statement={sideEffectImport(extension.importPath)} />
			</div>
			<CodeBlock code={extension.signature} copyable={false} className="mt-3" />
			{extension.description && (
				<div className="mt-2">
					<Markdown source={extension.description} labels headingTag="h4" />
				</div>
			)}
		</article>
	);
}
