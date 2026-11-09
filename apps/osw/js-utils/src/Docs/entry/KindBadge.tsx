import type { DocsEntry } from '../model';

const STYLES: Record<string, string> = {
	function: 'border-primary-200 bg-primary-100 text-primary-850',
	class: 'border-secondary-200 bg-secondary-100 text-secondary-850',
	variable: 'border-tertiary-200 bg-tertiary-100 text-tertiary-850',
	type: 'border-neutral-100 bg-neutral-30 text-neutral-920',
	interface: 'border-neutral-100 bg-neutral-30 text-neutral-920',
	enum: 'border-neutral-100 bg-neutral-30 text-neutral-920',
	prototype: 'border-quaternary-200 bg-quaternary-100 text-quaternary-850',
	static: 'border-success-200 bg-success-100 text-success-850',
};

const LABELS: Record<string, string> = { variable: 'const', prototype: 'proto' };

/** Small pill naming a declaration kind or extension kind */
export function KindBadge({ kind }: { kind: string }) {
	return (
		<span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[kind] ?? STYLES['type']}`}>
			{LABELS[kind] ?? kind}
		</span>
	);
}

/** Distinct extension kinds of an entry, for badges (two proto modules → one "proto") */
export const extensionKinds = (entry: DocsEntry) => [...new Set(entry.extensions.map((extension) => extension.kind))];
