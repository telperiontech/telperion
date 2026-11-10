import { paintletPath, storyPath } from '../routing';
import { paintlets } from '../stories';

interface StorySidebarProps {
	paintletId: string;
	storyId: string;
	/** Called after a link is followed, e.g. to close the mobile drawer */
	onNavigate?: () => void;
}

const linkBase = 'block truncate rounded-md px-2 py-1 text-[13px] transition-colors';
const linkIdle = 'text-neutral-920 hover:bg-neutral-50 hover:text-neutral-990';
const linkActive = 'bg-secondary-100 font-medium text-secondary-850';

export function StorySidebar({ paintletId, storyId, onNavigate }: StorySidebarProps) {
	return (
		<nav aria-label="Paintlets" className="text-sm">
			{paintlets.map((paintlet) => (
				<section key={paintlet.id} className="mt-5 first:mt-0">
					<a
						href={paintletPath(paintlet.id)}
						onClick={onNavigate}
						className={`block px-2 text-xs font-semibold tracking-wide uppercase ${paintlet.id === paintletId ? 'text-secondary-800' : 'text-neutral-850 hover:text-neutral-990'}`}
					>
						{paintlet.title}
					</a>
					<ul className="mt-1.5 space-y-0.5">
						{paintlet.stories.map((story) => {
							const active = paintlet.id === paintletId && story.id === storyId;

							return (
								<li key={story.id}>
									<a
										href={storyPath(paintlet.id, story.id)}
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
