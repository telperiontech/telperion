import { Code } from '@osw/react';
import { Panel, PanelAction } from '@osw/docs';
import type { LoggedEvent } from './use-event-log';

interface EventsPanelProps {
	events: readonly LoggedEvent[];
	/** Event names being listened to */
	names: readonly string[];
	onClear: () => void;
}

/** Live log of the events the story's elements fire, like Storybook's actions panel */
export function EventsPanel({ events, names, onClear }: EventsPanelProps) {
	return (
		<Panel
			id="events"
			icon="bolt"
			title="Events"
			actions={
				<PanelAction icon="delete_sweep" onClick={onClear} disabled={!events.length}>
					Clear
				</PanelAction>
			}
		>
			{events.length ? (
				<ol className="max-h-72 divide-y divide-neutral-100 overflow-y-auto font-mono text-xs" aria-live="polite">
					{events.map((event) => (
						<li key={event.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-4 py-2">
							<span className="text-neutral-550">{event.time}</span>
							<span className="min-w-0">
								<span className="font-semibold text-secondary-800">{event.name}</span>
								<span className="text-neutral-850"> on &lt;{event.target}&gt;</span>
								{event.summary && <span className="block truncate text-neutral-920" title={event.summary}>{event.summary}</span>}
							</span>
						</li>
					))}
				</ol>
			) : (
				<p className="px-4 py-6 text-sm text-neutral-850">
					Interact with the preview to see events. Listening to {names.map((name) => <Code key={name} code={name} className="mr-1" />)}
				</p>
			)}
		</Panel>
	);
}
