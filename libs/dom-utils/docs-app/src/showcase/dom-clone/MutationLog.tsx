import type { LoggedMutation } from './use-mutation-log';

/** Latest source mutations, newest first */
export function MutationLog({ log }: { log: LoggedMutation[] }) {
	if (!log.length) {
		return <p className="text-xs text-neutral-550">No mutations yet. Use the buttons above.</p>;
	}

	return (
		<ol className="space-y-1 font-mono text-xs" aria-live="polite">
			{log.map((entry) => (
				<li key={entry.id} className="flex items-center gap-2">
					<span className={`w-20 shrink-0 font-sans text-[11px] font-semibold ${entry.mirrored ? 'text-success-700' : 'text-neutral-550'}`}>
						{entry.mirrored ? '✓ mirrored' : '✕ skipped'}
					</span>
					<span className="text-secondary-660">{entry.type}</span>
					<span className="truncate text-neutral-660">{entry.detail}</span>
				</li>
			))}
		</ol>
	);
}
