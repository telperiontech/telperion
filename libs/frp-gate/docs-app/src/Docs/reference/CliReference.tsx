import { CodeLine, DataTable, Markdown } from '@osw/docs';
import { Code } from '@osw/react';
import type { CliCommand } from '../../model/types';
import { model } from '../model';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const flagName = (name: string) => (name.length === 1 ? `-${name}` : `--${name}`);

function Command({ command }: { command: CliCommand }) {
	const id = `command-${command.name || 'server'}`;

	return (
		<section aria-labelledby={id} className="mt-10">
			<h2 id={id} className="scroll-mt-20 text-lg font-semibold tracking-tight">{command.name || 'Server'}</h2>
			<CodeLine code={`frp-gate ${command.synopsis}`.trim()} language="sh" prompt="$" className="mt-3 max-w-xl bg-neutral-10" />
			<p className="mt-3 text-[15px] text-neutral-660">{capitalize(command.summary)}.</p>
			{command.details && <Markdown source={command.details} />}
			{command.flags.length > 0 && (
				<DataTable
					className="mt-4"
					header={['Flag', 'Default', 'Meaning']}
					rows={command.flags.map((flag) => [
						<Code key="name" code={flagName(flag.name)} />,
						<Code key="default" code={flag.default} />,
						capitalize(flag.description),
					])}
				/>
			)}
		</section>
	);
}

/** Commands of the `frp-gate` binary: the usage text and each command's function in `cmd/frp-gate` */
export function CliReference() {
	return (
		<>
			{model.cli.map((command) => <Command key={command.name} command={command} />)}
		</>
	);
}
