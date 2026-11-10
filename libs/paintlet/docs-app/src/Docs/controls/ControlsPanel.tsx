import { useMemo } from 'react';
import { Icon } from '@osw/react';
import { controlsOf, type Args, type StoryDoc } from '../stories';
import { ControlInput } from './ControlInput';

interface ControlsPanelProps {
	story: StoryDoc;
	args: Args;
	changed: readonly string[];
	onChange: (name: string, value: unknown) => void;
	onReset: () => void;
}

/** Storybook-like controls generated from the story's `argTypes` */
export function ControlsPanel({ story, args, changed, onChange, onReset }: ControlsPanelProps) {
	const controls = useMemo(() => controlsOf(story), [story]);

	return (
		<section aria-labelledby="controls-title" className="rounded-xl border border-neutral-100">
			<header className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2.5">
				<h2 id="controls-title" className="flex items-center gap-2 text-sm font-semibold">
					<Icon name="tune" size={18} />
					Controls
				</h2>
				<button
					type="button"
					onClick={onReset}
					disabled={!changed.length}
					className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-920 transition-colors hover:bg-neutral-50 hover:text-neutral-990 disabled:pointer-events-none disabled:opacity-40"
				>
					<Icon name="restart_alt" size={16} />
					Reset
				</button>
			</header>

			{controls.length ? (
				<ul className="divide-y divide-neutral-100">
					{controls.map(({ name, control, description, defaultSummary }) => {
						const id = `control-${name}`;

						return (
							<li key={name} className="grid gap-1.5 px-4 py-3">
								<div className="flex items-baseline justify-between gap-2">
									<label htmlFor={id} className="font-mono text-xs font-semibold text-neutral-990">
										{name}
										{changed.includes(name) && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-secondary-500 align-middle" title="Changed" />}
									</label>
									{defaultSummary && <span className="font-mono text-[11px] text-neutral-550">default {defaultSummary}</span>}
								</div>
								<ControlInput id={id} control={control} value={args[name]} onChange={(value) => onChange(name, value)} />
								{description && <p className="text-xs text-neutral-850">{description}</p>}
							</li>
						);
					})}
				</ul>
			) : (
				<p className="px-4 py-6 text-sm text-neutral-850">This story has no configurable args.</p>
			)}
		</section>
	);
}
