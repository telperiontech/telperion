import type { EcosystemId } from '../data';

export interface EcosystemTone {
	/** Small identity dot */
	dot: string;
	/** Tinted icon tile on cards */
	tile: string;
	/** Card border on hover / focus */
	hoverBorder: string;
	/** Thin top bar revealed on card hover */
	bar: string;
	/** Active filter chip */
	chip: string;
}

/**
 * Per-ecosystem color classes, written out in full so Tailwind can scan them.
 * Text shades (660-710) are the lightest that keep WCAG AA (4.5:1) on the 70 tile
 * backgrounds; tertiary/success/quaternary need the darker end of that range.
 */
export const ecosystemTones: Record<EcosystemId, EcosystemTone> = {
	core: {
		dot: 'bg-primary-500',
		tile: 'border-primary-150 bg-primary-70 text-primary-670',
		hoverBorder: 'hover:border-primary-240 focus-within:border-primary-240',
		bar: 'from-primary-500 to-secondary-500',
		chip: 'border-primary-240 bg-primary-70 text-primary-710',
	},
	browser: {
		dot: 'bg-tertiary-500',
		tile: 'border-tertiary-160 bg-tertiary-70 text-tertiary-700',
		hoverBorder: 'hover:border-tertiary-250 focus-within:border-tertiary-250',
		bar: 'from-tertiary-500 to-primary-500',
		chip: 'border-tertiary-250 bg-tertiary-70 text-tertiary-700',
	},
	frameworks: {
		dot: 'bg-secondary-500',
		tile: 'border-secondary-150 bg-secondary-70 text-secondary-660',
		hoverBorder: 'hover:border-secondary-240 focus-within:border-secondary-240',
		bar: 'from-secondary-500 to-tertiary-500',
		chip: 'border-secondary-240 bg-secondary-70 text-secondary-710',
	},
	node: {
		dot: 'bg-success-500',
		tile: 'border-success-150 bg-success-70 text-success-700',
		hoverBorder: 'hover:border-success-250 focus-within:border-success-250',
		bar: 'from-success-500 to-tertiary-500',
		chip: 'border-success-250 bg-success-70 text-success-700',
	},
	docker: {
		dot: 'bg-quaternary-500',
		tile: 'border-quaternary-150 bg-quaternary-70 text-quaternary-700',
		hoverBorder: 'hover:border-quaternary-250 focus-within:border-quaternary-250',
		bar: 'from-quaternary-500 to-secondary-500',
		chip: 'border-quaternary-250 bg-quaternary-70 text-quaternary-700',
	},
};
