import { CopyButton } from '@osw/react';

interface ImportLineProps {
	/** Full statement, e.g. `import { difference } from "@telperion/js-utils/array/difference";` */
	statement: string;
}

export function ImportLine({ statement }: ImportLineProps) {
	return (
		<div className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-30 py-1 pr-1 pl-3">
			<code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-990" title={statement}>
				{statement}
			</code>
			<CopyButton text={statement} />
		</div>
	);
}

export const namedImport = (names: string[], from: string) => `import { ${names.join(', ')} } from "${from}";`;
export const sideEffectImport = (from: string) => `import "${from}";`;
