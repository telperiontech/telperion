import type { ComponentType } from 'react';
import type { DocsEntry } from '@osw/api';
import { DomCloneDemo } from './dom-clone/DomCloneDemo';
import { GetParentsDemo } from './get-parents/GetParentsDemo';

interface Demo {
	component: ComponentType;
	description: string;
}

/** Live demo per entry id; entries without one show nothing */
const demos: Record<string, Demo> = {
	'dom-clone': {
		component: DomCloneDemo,
		description: 'Change the source card on the left. The real DomClone mirrors each change onto the clone on the right.',
	},
	'get-parents': {
		component: GetParentsDemo,
		description: 'Pick an element, then pull ancestors from the generator one at a time. Nothing is walked until you ask for it.',
	},
};

/** The "Try it" section of an entry page */
export function EntryShowcase({ entry }: { entry: DocsEntry }) {
	const demo = demos[entry.id];

	if (!demo) return null;

	const Demo = demo.component;

	return (
		<section aria-labelledby="try-it" className="mt-10">
			<h2 id="try-it" className="text-lg font-semibold tracking-tight">Try it</h2>
			<p className="mt-1 text-sm text-neutral-660">{demo.description}</p>
			<div className="mt-4">
				<Demo />
			</div>
		</section>
	);
}
