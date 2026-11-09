import { ecosystems, libraries } from '../data';

const facts = [
	{ value: libraries.length, label: 'packages', tone: 'text-primary-700' },
	{ value: ecosystems.length, label: 'ecosystems', tone: 'text-secondary-700' },
	{ value: 'MIT', label: 'licensed', tone: 'text-tertiary-850' },
];

export function HeroFacts() {
	return (
		<dl className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
			{facts.map((fact) => (
				<div key={fact.label} className="flex items-baseline gap-1.5">
					<dt className="sr-only">{fact.label}</dt>
					<dd className={`font-mono text-base font-semibold ${fact.tone}`}>{fact.value}</dd>
					<span aria-hidden="true" className="text-neutral-920">{fact.label}</span>
				</div>
			))}
		</dl>
	);
}
