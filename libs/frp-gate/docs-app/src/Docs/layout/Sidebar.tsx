import { getPage, model } from '../model';
import { homePath, pagePath } from '../routing';

interface SidebarProps {
	/** Slug of the current page; `''` for the overview */
	activeSlug?: string;
	/** Called after a link is followed, to close the mobile drawer */
	onNavigate?: () => void;
}

const linkBase = 'block truncate rounded-md px-2 py-1 text-[13px] transition-colors';
const linkIdle = 'text-neutral-660 hover:bg-neutral-20 hover:text-neutral-900';
const linkActive = 'bg-secondary-70 font-medium text-secondary-710';

function NavLink({ href, active, label, onNavigate }: { href: string; active: boolean; label: string; onNavigate?: () => void }) {
	return (
		<a href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`${linkBase} ${active ? linkActive : linkIdle}`}>
			{label}
		</a>
	);
}

/** Overview, then the guide, reference and examples groups of the model */
export function Sidebar({ activeSlug, onNavigate }: SidebarProps) {
	return (
		<nav aria-label="Pages" className="text-sm">
			<NavLink href={homePath()} active={activeSlug === ''} label="Overview" onNavigate={onNavigate} />

			{model.nav.map((group) => (
				<section key={group.title} className="mt-5">
					<h2 className="px-2 text-xs font-semibold tracking-wide text-neutral-550 uppercase">{group.title}</h2>
					<ul className="mt-1.5 space-y-0.5">
						{group.slugs.map((slug) => (
							<li key={slug}>
								<NavLink href={pagePath(slug)} active={activeSlug === slug} label={getPage(slug)?.title ?? slug} onNavigate={onNavigate} />
							</li>
						))}
					</ul>
				</section>
			))}
		</nav>
	);
}
