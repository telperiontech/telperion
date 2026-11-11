import { CopyButton } from '@osw/react';

interface InstallCommandProps {
	command: string;
	/** Background and spacing; the frame itself is shared */
	className?: string;
}

/** A `$ <command>` line with a copy button */
export function InstallCommand({ command, className = 'bg-neutral-30' }: InstallCommandProps) {
	return (
		<div className={`flex max-w-md items-center gap-2 rounded-lg border border-neutral-100 py-1 pr-1 pl-3 ${className}`}>
			<span aria-hidden="true" className="font-mono text-xs font-semibold text-tertiary-800 select-none">$</span>
			<code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
			<CopyButton text={command} />
		</div>
	);
}
