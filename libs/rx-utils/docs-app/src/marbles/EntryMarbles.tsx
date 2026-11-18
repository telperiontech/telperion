import type { DocsEntry } from '@osw/api';
import { scenarios } from './engine';
import { ScenarioShowcase } from './ScenarioShowcase';

/** The "See it run" section of an entry page; nothing for entries without scenarios */
export function EntryMarbles({ entry }: { entry: DocsEntry }) {
	const list = scenarios[entry.id];

	if (!list?.length) return null;

	return (
		<section aria-labelledby="see-it-run" className="mt-10">
			<h2 id="see-it-run" className="text-lg font-semibold tracking-tight">See it run</h2>
			<p className="mt-1 text-sm text-neutral-920">
				Live marble diagrams: the real code runs on virtual time and redraws as you change the inputs or the arguments.
			</p>
			<ScenarioShowcase scenarios={list} />
		</section>
	);
}
