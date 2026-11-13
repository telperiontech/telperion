import '@telperion/paintlet/plexus';
import type { CSSProperties } from 'react';

/**
 * Plain `paint()` and `@keyframes` rather than the `--tp-plexus()` CSS
 * functions, which need `@function` support. Without the Paint API the
 * declaration is dropped and the hero stays plain.
 */
const plexusStyle = {
	backgroundImage: '--tp-plexus()',
	'--tp-plexus-dot-color': 'var(--color-secondary-300)',
	'--tp-plexus-line-color': 'var(--color-primary-200)',
	'--tp-plexus-density': 9000,
	'--tp-plexus-dot-size': 3,
	'--tp-plexus-proximity': 120,
	'--tp-plexus-max-laps': 1,
	// Fade out toward the bottom so the network blends into the next section
	maskImage: 'linear-gradient(to bottom, black 55%, transparent)',
} as CSSProperties;

/** Animated particle network behind the hero, drawn by the `tp-plexus` paintlet. */
export function HeroBackdrop() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 -z-10 animate-[tp-plexus-animation_90s_linear_infinite] motion-reduce:animate-none"
			style={plexusStyle}
		/>
	);
}
