import type { ReactNode } from 'react';
import { CodeBlock, DataTable, Inline } from '@osw/docs';
import type { ApiAttribute, ApiEvent, ApiMethod, ApiNamed, ApiProperty } from '../model';

const Code = ({ children }: { children?: string }) =>
	children ? <code className="font-mono text-[12px] whitespace-pre-wrap text-neutral-990">{children}</code> : <span className="text-neutral-300">—</span>;

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
					<Code>{attribute.name}</Code>,
					<Code>{attribute.type}</Code>,
					<Code>{attribute.default}</Code>,
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
						<Code>{property.name}</Code>
						{property.readonly && <span className="rounded bg-neutral-50 px-1 text-[10px] text-neutral-850">readonly</span>}
					</span>,
					<Code>{property.type}</Code>,
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
				rows={events.map((event) => [<Code>{event.name}</Code>, <Code>{event.type}</Code>, <Text text={event.description} />])}
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
					<Code>{item.name || '(default)'}</Code>,
					...(withDefaults ? [<Code>{item.default}</Code>] : []),
					<Text text={item.description} />,
				])}
			/>
		</ApiSection>
	);
}
