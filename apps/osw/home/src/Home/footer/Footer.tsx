import { companyNav, NPM_ORG_URL, REPO_URL, telperionLinks } from '../data';
import { ExternalLink, TreeMark } from '../ui';
import { FooterColumn } from './FooterColumn';

const openSourceLinks = [
	{ label: 'GitHub', href: REPO_URL },
	{ label: 'npm @telperion', href: NPM_ORG_URL },
	{ label: 'Open source at Telperion', href: telperionLinks.openSource },
	{ label: 'Report an issue', href: `${REPO_URL}/issues` },
];

export function Footer() {
	return (
		<footer className="bg-white">
			<div aria-hidden="true" className="h-1 bg-linear-to-r from-primary-500 via-secondary-500 to-tertiary-500" />
			<div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
				<div className="max-w-sm">
					<ExternalLink href={telperionLinks.home} className="inline-flex items-center gap-2.5 text-neutral-990">
						<TreeMark className="size-7 text-secondary-600" />
						<span className="font-semibold tracking-tight">Telperion</span>
					</ExternalLink>
					<p className="mt-4 text-sm leading-relaxed text-neutral-920">
						Telperion builds privacy-first, open-source tools for team collaboration. This is where we share the libraries we build along the way.
					</p>
					<ExternalLink
						href={telperionLinks.home}
						className="mt-4 inline-flex text-sm font-medium text-secondary-800 hover:underline"
					>
						Visit telperion.tr →
					</ExternalLink>
				</div>

				<FooterColumn title="Open source" links={openSourceLinks} />
				<FooterColumn title="Company" links={companyNav} />
			</div>

			<div className="border-t border-neutral-100">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-850 sm:px-6">
					<p>© {new Date().getFullYear()} Telperion. Released under the MIT License.</p>
					<p>
						Some packages are still published under the legacy <code className="font-mono">@thalesrc</code> scope.
					</p>
				</div>
			</div>
		</footer>
	);
}
