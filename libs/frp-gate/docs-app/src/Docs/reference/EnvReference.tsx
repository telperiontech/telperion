import { DataTable, Inline } from '@osw/docs';
import { Code } from '@osw/react';
import { model } from '../model';
import { Pill } from './Pill';

/** Every `FRP_GATE_*` variable: name and default from `internal/config`, meaning from the README */
export function EnvReference() {
	return (
		<DataTable
			className="mt-8"
			header={['Variable', 'Default', 'Meaning']}
			rows={model.env.map((envVar) => [
				<div key="name" id={envVar.name.toLowerCase()} className="flex scroll-mt-20 flex-col items-start gap-1">
					<Code code={envVar.name} />
					{envVar.required && <Pill tone="primary">required</Pill>}
					{envVar.fileVariant && <span className="text-xs text-neutral-550">or <Code code={`${envVar.name}_FILE`} /></span>}
				</div>,
				envVar.default ? <Code key="default" code={envVar.default} /> : <span key="default" className="text-neutral-270">none</span>,
				<Inline key="meaning" text={envVar.description} />,
			])}
		/>
	);
}
