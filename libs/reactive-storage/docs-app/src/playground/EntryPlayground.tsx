import type { DocsEntry } from '@osw/api';
import type { DemoKind } from './demo-storage';
import { StoragePlayground } from './StoragePlayground';

interface EntryDemo {
	kind: DemoKind;
	description: string;
}

/** The storage each entry page demonstrates; the base class and the generic one run on localStorage */
const DEMOS: Record<string, EntryDemo> = {
	'reactive-storage': {
		kind: 'local',
		description: 'The shared API, shown on a ReactiveWebLocalStorage. Write a value, then watch which subscribers receive it.',
	},
	'reactive-web-storage': {
		kind: 'local',
		description: 'Shown with window.localStorage as the Storage object. Write a value, then watch which subscribers receive it.',
	},
	'reactive-web-local-storage': {
		kind: 'local',
		description: 'Write a value, then watch which subscribers receive it. The data is still there after a reload.',
	},
	'reactive-web-session-storage': {
		kind: 'session',
		description: 'Write a value, then watch which subscribers receive it. The data survives a reload, but not closing the tab.',
	},
	'reactive-cookie-storage': {
		kind: 'cookie',
		description: 'Two instances share a linker: writes made through one reach the other’s subscribers. The demo cookie expires after an hour.',
	},
};

/** The "Try it" section of an entry page; nothing for entries without a demo */
export function EntryPlayground({ entry }: { entry: DocsEntry }) {
	const demo = DEMOS[entry.id];

	if (!demo) return null;

	return (
		<section aria-labelledby="try-it" className="mt-10">
			<h2 id="try-it" className="text-lg font-semibold tracking-tight">Try it</h2>
			<p className="mt-1 text-sm text-neutral-920">{demo.description}</p>
			<StoragePlayground key={entry.id} kind={demo.kind} />
		</section>
	);
}
