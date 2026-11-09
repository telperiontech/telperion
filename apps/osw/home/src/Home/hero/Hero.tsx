import type { MouseEvent } from 'react';
import { REPO_URL, telperionLinks } from '../data';
import { ExternalLink, Icon } from '../ui';
import { HeroBackdrop } from './HeroBackdrop';
import { HeroFacts } from './HeroFacts';

export const CATALOG_ID = 'libraries';

/** Scroll in-page instead of navigating, so the shell router never sees the hash link. */
function scrollToCatalog(event: MouseEvent<HTMLAnchorElement>) {
	event.preventDefault();
	document.getElementById(CATALOG_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Hero() {
	return (
		<section className="relative isolate overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
			<HeroBackdrop />

			<div className="mx-auto max-w-3xl text-center">
				<ExternalLink
					href={telperionLinks.openSource}
					className="inline-flex items-center gap-1.5 rounded-full border border-secondary-200 bg-secondary-100 px-3 py-1 text-xs font-medium text-secondary-850 hover:border-secondary-300 transition-colors"
				>
					<span aria-hidden="true" className="size-1.5 rounded-full bg-tertiary-500" />
					Open source by Telperion
					<Icon name="arrow_outward" size={14} />
				</ExternalLink>

				<h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-neutral-990 sm:text-6xl">
					Small, sharp libraries for the{' '}
					<span className="bg-linear-to-r from-primary-600 via-secondary-600 to-tertiary-800 bg-clip-text text-transparent">
						modern web
					</span>
				</h1>

				<p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-neutral-920">
					TypeScript utilities, web components, Angular and React building blocks, and developer infrastructure. Built and maintained in one open monorepo.
				</p>

				<div className="mt-9 flex flex-wrap items-center justify-center gap-3">
					<a
						href={`#${CATALOG_ID}`}
						onClick={scrollToCatalog}
						className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-primary-600 to-secondary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-secondary-500/25 hover:from-primary-700 hover:to-secondary-700 transition-colors"
					>
						Browse libraries
						<Icon name="arrow_downward" size={18} />
					</a>
					<ExternalLink
						href={REPO_URL}
						className="inline-flex items-center gap-2 rounded-lg border border-neutral-100 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-990 hover:border-secondary-300 hover:text-secondary-850 transition-colors"
					>
						<Icon brand="github" size={16} />
						Star on GitHub
					</ExternalLink>
				</div>

				<HeroFacts />
			</div>
		</section>
	);
}
