import { Icon } from '@osw/react';
import { HomeSection } from './HomeSection';

export interface Feature {
	icon: string;
	title: string;
	text: string;
}

interface FeatureGridProps {
	title: string;
	features: readonly Feature[];
}

/** The icon-headed selling points of a library home page */
export function FeatureGrid({ title, features }: FeatureGridProps) {
	return (
		<HomeSection id="features" title={title}>
			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{features.map((feature) => (
					<div key={feature.title}>
						<span className="grid size-10 place-items-center rounded-lg bg-secondary-100 text-secondary-800">
							<Icon name={feature.icon} size={22} />
						</span>
						<h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
						<p className="mt-1.5 text-sm leading-relaxed text-neutral-920">{feature.text}</p>
					</div>
				))}
			</div>
		</HomeSection>
	);
}
