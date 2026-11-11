import { ExternalLink } from '@osw/react';
import { Markdown, sourceUrl } from '@osw/docs';
import type { ElementDoc } from '../model';
import { AttributesTable, EventsTable, MethodsList, NamedTable, PropertiesTable } from './ApiTables';

/** API reference of one custom element, anchored at its tag name */
export function ElementReference({ element }: { element: ElementDoc }) {
	return (
		<article id={element.tagName} className="scroll-mt-20 rounded-xl border border-neutral-100 p-5 sm:p-6">
			<header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="font-mono text-lg font-semibold">
					<a href={`#${element.tagName}`} className="hover:text-secondary-800">{`<${element.tagName}>`}</a>
				</h3>
				<span className="font-mono text-xs text-neutral-850">{element.className}</span>
				<ExternalLink href={sourceUrl(element.sourcePath)} className="ml-auto text-xs font-medium text-neutral-850 hover:text-secondary-800">
					Source
				</ExternalLink>
			</header>

			{element.description ? (
				<Markdown source={element.description} headingTag="h4" />
			) : (
				<p className="mt-3 text-sm text-neutral-850">No description yet.</p>
			)}

			<AttributesTable attributes={element.attributes} />
			<PropertiesTable properties={element.properties} />
			<MethodsList methods={element.methods} />
			<EventsTable events={element.events} />
			<NamedTable title="Slots" label="Slot" items={element.slots} />
			<NamedTable title="CSS custom properties" label="Property" items={element.cssProperties} />
			<NamedTable title="CSS parts" label="Part" items={element.cssParts} />
			<NamedTable title="CSS states" label="State" items={element.cssStates} />
		</article>
	);
}
