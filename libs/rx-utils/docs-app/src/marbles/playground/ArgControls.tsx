import { ControlInput, type Control } from '@osw/stories';
import type { ArgControl, ArgSpec, ScenarioArgs } from '../engine';

/** Scenario arg controls are the playground controls of `@osw/stories` */
function toControl(control: ArgControl): Control {
	switch (control.type) {
		case 'range':
			return { kind: 'range', min: control.min, max: control.max, step: control.step ?? 1 };
		case 'select':
			return { kind: 'select', options: control.options };
		default:
			return { kind: 'boolean' };
	}
}

interface ArgControlsProps {
	specs: Record<string, ArgSpec<unknown>>;
	values: ScenarioArgs;
	onChange: (name: string, value: unknown) => void;
	/** Prefix for input ids, unique per playground */
	idPrefix: string;
}

/** The operator's arguments, re-running the diagram on every change */
export function ArgControls({ specs, values, onChange, idPrefix }: ArgControlsProps) {
	return (
		<div className="grid gap-4 border-t border-neutral-40 px-4 py-3 sm:grid-cols-2">
			{Object.entries(specs).map(([name, spec]) => {
				const id = `${idPrefix}-${name}`;

				return (
					<div key={name} className="grid content-start gap-1.5">
						<label htmlFor={id} className="font-mono text-xs font-semibold text-neutral-900">{name}</label>
						<ControlInput id={id} control={toControl(spec.control)} value={values[name]} onChange={(value) => onChange(name, value)} />
						{spec.description && <p className="text-xs text-neutral-550">{spec.description}</p>}
					</div>
				);
			})}
		</div>
	);
}
