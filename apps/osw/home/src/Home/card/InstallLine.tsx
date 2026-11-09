import { installCommand, type Library } from '../data';
import { CopyButton } from '../ui';

export function InstallLine({ library }: { library: Library }) {
	const command = installCommand(library);

	return (
		<div className="relative z-10 flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-30 py-1 pr-1 pl-3">
			<span aria-hidden="true" className="font-mono text-xs font-semibold text-tertiary-800 select-none">$</span>
			<code className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-990" title={command}>
				{command}
			</code>
			<CopyButton text={command} />
		</div>
	);
}
