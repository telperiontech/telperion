import type { CSSProperties } from 'react';

/**
 * Inline paintlet styles for the home page, so the page itself runs on the library.
 * Each sits on top of a Tailwind gradient fallback: browsers that cannot parse
 * `--tp-*()` drop the declaration and keep the fallback.
 */

/** Animated PAL gradient in the osw brand colors */
export const heroVisualStyle = {
	backgroundImage: '--tp-pal-gradient()',
	animation: '--tp-pal-gradient-animation(24s)',
	'--tp-pal-gradient-color-1': '#6366f1',
	'--tp-pal-gradient-color-2': '#8b5cf6',
	'--tp-pal-gradient-color-3': '#14b8a6',
	'--tp-pal-gradient-color-4': '#f59e0b',
	'--tp-pal-gradient-complexity': 7,
	'--tp-pal-gradient-seed': 42,
	// Additive modes (`screen`, `lighter`) wash these brand colors out to white
	'--tp-pal-gradient-composite-points': 'source-over',
	'--tp-pal-gradient-composite-lines': 'soft-light',
} as CSSProperties;

/** Faint low-poly backdrop behind the hero */
export const heroBackdropStyle = {
	backgroundImage: '--tp-low-poly-mesh()',
	'--tp-low-poly-color-1': '#ffffff',
	'--tp-low-poly-color-2': '#e9e9f2',
	'--tp-low-poly-cell-size': 90,
	'--tp-low-poly-jitter': 0.45,
	'--tp-low-poly-seed': 7,
	'--tp-low-poly-stroke-width': 0,
} as CSSProperties;
