import { ExternalLink } from '../ui';

interface FooterColumnProps {
	title: string;
	links: { label: string; href: string }[];
}

export function FooterColumn({ title, links }: FooterColumnProps) {
	return (
		<div>
			<h2 className="text-sm font-semibold text-neutral-990">{title}</h2>
			<ul className="mt-3 space-y-2">
				{links.map((link) => (
					<li key={link.href}>
						<ExternalLink href={link.href} className="text-sm text-neutral-920 hover:text-neutral-990 transition-colors">
							{link.label}
						</ExternalLink>
					</li>
				))}
			</ul>
		</div>
	);
}
