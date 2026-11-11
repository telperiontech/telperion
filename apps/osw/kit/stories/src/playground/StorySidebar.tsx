import type { ComponentDoc } from '../core';

interface StorySidebarProps {
	components: readonly ComponentDoc[];
	/** Accessible name of the list, e.g. `Paintlets` */
	label: string;
	componentHref: (componentId: string) => string;
	storyHref: (componentId: string, storyId: string) => string;
	activeComponentId?: string;
	activeStoryId?: string;
	/** Called after a link is followed, e.g. to close the mobile drawer */
	onNavigate?: () => void;
}

const linkBase = 'block truncate rounded-md px-2 py-1 text-[13px] transition-colors';
const linkIdle = 'text-neutral-920 hover:bg-neutral-50 hover:text-neutral-990';
const linkActive = 'bg-secondary-100 font-medium text-secondary-850';

/** Components and their stories, grouped like Storybook's sidebar */
export function StorySidebar({ components, label, componentHref, storyHref, activeComponentId, activeStoryId, onNavigate }: StorySidebarProps) {
	return (
		<nav aria-label={label} className="text-sm">
			{components.map((component) => (
				<section key={component.id} className="mt-5 first:mt-0">
					<a
						href={componentHref(component.id)}
						onClick={onNavigate}
						className={`block px-2 text-xs font-semibold tracking-wide uppercase ${component.id === activeComponentId ? 'text-secondary-800' : 'text-neutral-850 hover:text-neutral-990'}`}
					>
						{component.title}
					</a>
					<ul className="mt-1.5 space-y-0.5">
						{component.stories.map((story) => {
							const active = component.id === activeComponentId && story.id === activeStoryId;

							return (
								<li key={story.id}>
									<a
										href={storyHref(component.id, story.id)}
										onClick={onNavigate}
										aria-current={active ? 'page' : undefined}
										className={`${linkBase} ${active ? linkActive : linkIdle}`}
									>
										{story.name}
									</a>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</nav>
	);
}
