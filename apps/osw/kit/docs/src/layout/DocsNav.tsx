import type { ReactNode } from 'react';
import { ExternalLink, Icon, TreeMark } from '@osw/react';
import { npmUrl } from '../meta';

export interface DocsNavProps {
	/** Short library name shown next to the logo, e.g. `paintlet` */
	name: string;
	version: string;
	/** Landing page of the remote */
	homeHref: string;
	/** Source folder on GitHub */
	sourceUrl: string;
	packageName: string;
	/** Extra links placed before the GitHub / npm icons (style them with `navLinkClass`) */
	links?: ReactNode;
}

const iconLink = 'grid place-items-center size-9 rounded-lg text-neutral-920 hover:text-neutral-990 hover:bg-neutral-50 transition-colors';

/** Text link styling for the `links` slot */
export const navLinkClass =
	'mr-1 hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-920 transition-colors hover:bg-neutral-50 hover:text-neutral-990 sm:inline-flex';

export function DocsNav({ name, version, homeHref, sourceUrl, packageName, links }: DocsNavProps) {
	return (
		<header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
			<div aria-hidden="true" className="h-0.5 bg-linear-to-r from-primary-500 via-secondary-500 to-tertiary-500" />
			<nav aria-label="Main" className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
				<a href="/" className="flex items-center gap-2.5 rounded-md text-neutral-990" title="All libraries">
					<TreeMark className="size-7 text-secondary-600" />
					<span className="hidden font-semibold tracking-tight sm:inline">Telperion</span>
				</a>
				<span aria-hidden="true" className="text-neutral-200">/</span>
				<a href={homeHref} className="mr-auto flex min-w-0 items-center gap-2 font-mono text-sm font-semibold text-neutral-990">
					{name}
					<span className="rounded-full border border-primary-200 bg-primary-100 px-2 py-0.5 font-sans text-xs font-medium text-primary-850">
						v{version}
					</span>
				</a>

				{links}
				<ExternalLink href={sourceUrl} className={iconLink} aria-label="Source on GitHub" title="GitHub">
					<Icon brand="github" size={18} />
				</ExternalLink>
				<ExternalLink href={npmUrl(packageName)} className={iconLink} aria-label="Package on npm" title="npm">
					<Icon brand="npm" size={18} />
				</ExternalLink>
			</nav>
		</header>
	);
}
