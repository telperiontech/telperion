import type { ReactNode } from 'react';
import { Icon } from '@osw/react';

interface PanelProps {
	/** Prefix for the heading id the section is labelled by */
	id: string;
	icon: string;
	title: ReactNode;
	/** Header buttons, right-aligned (see `PanelAction`) */
	actions?: ReactNode;
	children: ReactNode;
}

/** A bordered tool panel with an icon heading, as used next to playground previews */
export function Panel({ id, icon, title, actions, children }: PanelProps) {
	const titleId = `${id}-title`;

	return (
		<section aria-labelledby={titleId} className="rounded-xl border border-neutral-100">
			<header className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-2.5">
				<h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
					<Icon name={icon} size={18} />
					{title}
				</h2>
				{actions}
			</header>
			{children}
		</section>
	);
}
