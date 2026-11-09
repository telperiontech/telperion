import { NPM_ORG_URL, REPO_URL, telperionLinks } from '../data';
import { ExternalLink, Icon, TreeMark } from '../ui';

const iconLink = 'grid place-items-center size-9 rounded-lg text-neutral-920 hover:text-neutral-990 hover:bg-neutral-50 transition-colors';

export function Nav() {
	return (
		<header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
			<div aria-hidden="true" className="h-0.5 bg-linear-to-r from-primary-500 via-secondary-500 to-tertiary-500" />
			<nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
				<a href="/" className="mr-auto flex items-center gap-2.5 rounded-md text-neutral-990">
					<TreeMark className="size-7 text-secondary-600" />
					<span className="font-semibold tracking-tight">Telperion</span>
					<span className="hidden rounded-full border border-tertiary-200 bg-tertiary-100 px-2 py-0.5 text-xs font-medium text-tertiary-850 sm:inline">
						Open Source
					</span>
				</a>

				<ExternalLink
					href={telperionLinks.home}
					className="hidden items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-920 hover:text-neutral-990 hover:bg-neutral-50 transition-colors sm:flex"
				>
					telperion.tr
					<Icon name="arrow_outward" size={16} />
				</ExternalLink>
				<ExternalLink href={REPO_URL} className={iconLink} aria-label="GitHub repository" title="GitHub">
					<Icon brand="github" size={18} />
				</ExternalLink>
				<ExternalLink href={NPM_ORG_URL} className={iconLink} aria-label="npm organization" title="npm">
					<Icon brand="npm" size={18} />
				</ExternalLink>
			</nav>
		</header>
	);
}
