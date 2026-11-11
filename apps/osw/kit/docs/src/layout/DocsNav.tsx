import type { ReactNode } from 'react';
import { OSW_SLOTS } from '@osw/core';
import { ExternalLink, Icon, ShellSlot } from '@osw/react';
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

/**
 * Fills the shell header: the library name and version next to the logo, and the
 * remote's links with its GitHub / npm icons on the right.
 */
export function DocsNav({ name, version, homeHref, sourceUrl, packageName, links }: DocsNavProps) {
	return (
		<>
			<ShellSlot name={OSW_SLOTS.headerContext}>
				<span aria-hidden="true" className="text-neutral-200">/</span>
				<a href={homeHref} className="flex min-w-0 items-center gap-2 font-mono text-sm font-semibold text-neutral-990">
					{name}
					<span className="rounded-full border border-primary-200 bg-primary-100 px-2 py-0.5 font-sans text-xs font-medium text-primary-850">
						v{version}
					</span>
				</a>
			</ShellSlot>

			<ShellSlot name={OSW_SLOTS.headerActions}>
				{links}
				<ExternalLink href={sourceUrl} className={iconLink} aria-label="Source on GitHub" title="GitHub">
					<Icon brand="github" size={18} />
				</ExternalLink>
				<ExternalLink href={npmUrl(packageName)} className={iconLink} aria-label="Package on npm" title="npm">
					<Icon brand="npm" size={18} />
				</ExternalLink>
			</ShellSlot>
		</>
	);
}
