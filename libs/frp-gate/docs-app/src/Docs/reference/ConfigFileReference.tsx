import { DataTable, Inline, Markdown } from '@osw/docs';
import { Code } from '@osw/react';
import { exampleId } from '../../model/ids';
import type { ConfigType } from '../../model/types';
import { model } from '../model';
import { Pill } from './Pill';

function ConfigSection({ type }: { type: ConfigType }) {
	const id = type.path ? `key-${exampleId(type.path)}` : 'top-level';

	return (
		<section aria-labelledby={id} className="mt-10">
			<h2 id={id} className="scroll-mt-20 text-lg font-semibold tracking-tight">
				{type.path ? <Code code={type.path} /> : 'Top level'}
			</h2>
			<Markdown source={type.description} />
			<DataTable
				className="mt-4"
				header={['Key', 'Type', 'Note']}
				rows={type.fields.map((field) => [
					<span key="key" className="inline-flex flex-wrap items-center gap-2">
						<Code code={field.key} />
						{field.required && <Pill tone="primary">required</Pill>}
					</span>,
					field.type,
					<Inline key="note" text={field.description} />,
				])}
			/>
		</section>
	);
}

/** The declarative config file, top level first: the structs of `internal/declare/file.go` */
export function ConfigFileReference() {
	return (
		<>
			{model.configFile.map((type) => <ConfigSection key={type.name} type={type} />)}
		</>
	);
}
