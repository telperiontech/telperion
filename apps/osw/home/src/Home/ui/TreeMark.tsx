interface TreeMarkProps {
	className?: string;
}

/** Minimal silver-tree logo mark; strokes follow `currentColor`. */
export function TreeMark({ className }: TreeMarkProps) {
	return (
		<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			<circle cx="16" cy="12" r="9" opacity="0.35" />
			<path d="M16 29V13" />
			<path d="M16 19l-5-5M16 16l5-5M16 23l4-3" />
			<circle cx="11" cy="14" r="1.2" fill="currentColor" stroke="none" />
			<circle cx="21" cy="11" r="1.2" fill="currentColor" stroke="none" />
			<circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
		</svg>
	);
}
