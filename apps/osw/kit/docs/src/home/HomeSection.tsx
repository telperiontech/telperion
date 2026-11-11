import type { ReactNode } from 'react';

interface HomeSectionProps {
	/** Prefix for the heading id the section is labelled by */
	id: string;
	title: ReactNode;
	intro?: ReactNode;
	children: ReactNode;
}

/** A full-width section of a library home page */
export function HomeSection({ id, title, intro, children }: HomeSectionProps) {
	const titleId = `${id}-title`;

	return (
		<section aria-labelledby={titleId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
			<h2 id={titleId} className="text-2xl font-semibold tracking-tight">{title}</h2>
			{intro && <p className="mt-2 max-w-2xl text-sm text-neutral-920">{intro}</p>}
			{children}
		</section>
	);
}
