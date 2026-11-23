import type { DocsEntry } from '../model';

const STYLES: Record<string, string> = {
	function: 'border-primary-150 bg-primary-70 text-primary-710',
	class: 'border-secondary-150 bg-secondary-70 text-secondary-710',
	variable: 'border-tertiary-160 bg-tertiary-70 text-tertiary-700',
	type: 'border-neutral-40 bg-neutral-10 text-neutral-660',
	interface: 'border-neutral-40 bg-neutral-10 text-neutral-660',
	enum: 'border-neutral-40 bg-neutral-10 text-neutral-660',
	prototype: 'border-quaternary-150 bg-quaternary-70 text-quaternary-700',
	static: 'border-success-150 bg-success-70 text-success-700',
	global: 'border-warning-150 bg-warning-70 text-warning-700',
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

/** Badges beside an entry's declaration kind: its extension kinds, then `global` when it declares globals */
export const entryKinds = (entry: DocsEntry): string[] => [...extensionKinds(entry), ...(entry.globals.length ? ['global'] : [])];
