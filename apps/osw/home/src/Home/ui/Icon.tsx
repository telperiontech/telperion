interface IconProps {
	/** Material Symbols glyph name */
	name?: string;
	/** Simple Icons slug; renders a brand icon instead of a Material glyph */
	brand?: string;
	/** Size in px. Applied inline because `<tp-icon>` pre-applies `text-2xl`. */
	size?: number;
	filled?: boolean;
	/** Accessible label; icons without one are treated as decorative */
	label?: string;
	className?: string;
}

/**
 * Thin React wrapper over `<tp-icon>` from `@telperion/elements/icon`.
 * Keep `className` static: the element adds its own host classes on connect,
 * and React would overwrite them if the attribute changed between renders.
 */
export function Icon({ name, brand, size = 20, filled, label, className }: IconProps) {
	const a11y = label ? { 'aria-label': label } : { 'aria-hidden': 'true' as const };
	const style = { fontSize: `${size}px` };

	if (brand) {
		return <tp-icon family="simple-icons" slug={brand} class={className} style={style} {...a11y} />;
	}

	return (
		<tp-icon class={className} style={style} filled={filled ? '' : undefined} {...a11y}>
			{name}
		</tp-icon>
	);
}
