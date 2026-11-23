import { useState } from 'react';
import { Inline } from '@osw/docs';
import type { AnyMarbleScenario } from './engine';
import { MarblePlayground } from './playground/MarblePlayground';

const tabClass = (active: boolean) =>
	`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
		active ? 'bg-secondary-550 text-white' : 'border border-neutral-40 text-neutral-660 hover:border-neutral-110 hover:text-neutral-900'
	}`;

/** A playground per scenario, with a switcher when there are several */
export function ScenarioShowcase({ scenarios }: { scenarios: readonly AnyMarbleScenario[] }) {
	const [activeId, setActiveId] = useState(scenarios[0]?.id);
	const scenario = scenarios.find((candidate) => candidate.id === activeId) ?? scenarios[0];

	if (!scenario) return null;

	return (
		<div>
			{scenarios.length > 1 && (
				<div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Scenarios">
					{scenarios.map((candidate) => (
						<button key={candidate.id} type="button" aria-pressed={candidate === scenario} onClick={() => setActiveId(candidate.id)} className={tabClass(candidate === scenario)}>
							{candidate.title}
						</button>
					))}
				</div>
			)}
			{scenarios.length === 1 && <h3 className="mt-4 text-sm font-semibold">{scenario.title}</h3>}
			{scenario.description && (
				<p className="mt-3 text-sm leading-relaxed text-neutral-660">
					<Inline text={scenario.description} />
				</p>
			)}
			<MarblePlayground key={scenario.id} scenario={scenario} />
		</div>
	);
}
