import type { ReactNode } from 'react';
import { Code, CodeBlock, DataTable, Inline } from '@osw/docs';
import type { ApiAttribute, ApiEvent, ApiMethod, ApiNamed, ApiProperty } from '../model';

/** Names render plain; pass `language="ts"` for types and default values */
const ApiCode = ({ children, language }: { children?: string; language?: string }) =>
	children ? <Code code={children} language={language} /> : <span className="text-neutral-300">—</span>;

const Text = ({ text }: { text?: string }) => (text ? <Inline text={text.replace(/\s*\n\s*/g, ' ')} /> : <span className="text-neutral-300">—</span>);

function ApiSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
	if (!count) return null;

	return (
		<section className="mt-6">
			<h4 className="text-xs font-semibold tracking-wide text-neutral-850 uppercase">{title}</h4>
			{children}
		</section>
	);
}

export function AttributesTable({ attributes }: { attributes: ApiAttribute[] }) {
	return (
		<ApiSection title="Attributes" count={attributes.length}>
			<DataTable
				header={['Attribute', 'Type', 'Default', 'Description']}
				rows={attributes.map((attribute) => [
					<ApiCode>{attribute.name}</ApiCode>,
					<ApiCode language="ts">{attribute.type}</ApiCode>,
					<ApiCode language="ts">{attribute.default}</ApiCode>,
					<Text text={attribute.description} />,
				])}
			/>
		</ApiSection>
	);
}

/** Properties without an attribute: the JavaScript-only API (attribute-backed ones are listed above) */
export function PropertiesTable({ properties }: { properties: ApiProperty[] }) {
	const jsOnly = properties.filter((property) => !property.attribute);

	return (
		<ApiSection title="Properties" count={jsOnly.length}>
			<DataTable
				header={['Property', 'Type', 'Description']}
				rows={jsOnly.map((property) => [
					<span className="inline-flex flex-wrap items-center gap-1.5">
						<ApiCode>{property.name}</ApiCode>
						{property.readonly && <span className="rounded bg-neutral-50 px-1 text-[10px] text-neutral-850">readonly</span>}
					</span>,
					<ApiCode language="ts">{property.type}</ApiCode>,
					<Text text={property.description} />,
				])}
			/>
		</ApiSection>
	);
}

export function MethodsList({ methods }: { methods: ApiMethod[] }) {
	return (
		<ApiSection title="Methods" count={methods.length}>
			<ul className="mt-3 space-y-3">
				{methods.map((method) => (
					<li key={method.signature}>
						<CodeBlock code={method.signature} copyable={false} />
						{method.description && (
							<p className="mt-1.5 text-sm text-neutral-920">
								<Text text={method.description} />
							</p>
						)}
					</li>
				))}
			</ul>
		</ApiSection>
	);
}

export function EventsTable({ events }: { events: ApiEvent[] }) {
	return (
		<ApiSection title="Events" count={events.length}>
			<DataTable
				header={['Event', 'Type', 'Description']}
				rows={events.map((event) => [<ApiCode>{event.name}</ApiCode>, <ApiCode language="ts">{event.type}</ApiCode>, <Text text={event.description} />])}
			/>
		</ApiSection>
	);
}

/** Slots, CSS custom properties, parts and states share a name / description shape */
export function NamedTable({ title, label, items }: { title: string; label: string; items: ApiNamed[] }) {
	const withDefaults = items.some((item) => item.default);

	return (
		<ApiSection title={title} count={items.length}>
			<DataTable
				header={withDefaults ? [label, 'Default', 'Description'] : [label, 'Description']}
				rows={items.map((item) => [
					<ApiCode>{item.name || '(default)'}</ApiCode>,
					...(withDefaults ? [<ApiCode>{item.default}</ApiCode>] : []),
					<Text text={item.description} />,
				])}
			/>
		</ApiSection>
	);
}
