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
 * Text shades sit at 800/850 because the xyz-mixed scales stay light longer;
 * lighter shades of tertiary/success/quaternary fail contrast on white.
 */
export const ecosystemTones: Record<EcosystemId, EcosystemTone> = {
	core: {
		dot: 'bg-primary-500',
		tile: 'border-primary-200 bg-primary-100 text-primary-800',
		hoverBorder: 'hover:border-primary-300 focus-within:border-primary-300',
		bar: 'from-primary-500 to-secondary-500',
		chip: 'border-primary-300 bg-primary-100 text-primary-850',
	},
	browser: {
		dot: 'bg-tertiary-500',
		tile: 'border-tertiary-200 bg-tertiary-100 text-tertiary-850',
		hoverBorder: 'hover:border-tertiary-300 focus-within:border-tertiary-300',
		bar: 'from-tertiary-500 to-primary-500',
		chip: 'border-tertiary-300 bg-tertiary-100 text-tertiary-850',
	},
	frameworks: {
		dot: 'bg-secondary-500',
		tile: 'border-secondary-200 bg-secondary-100 text-secondary-800',
		hoverBorder: 'hover:border-secondary-300 focus-within:border-secondary-300',
		bar: 'from-secondary-500 to-tertiary-500',
		chip: 'border-secondary-300 bg-secondary-100 text-secondary-850',
	},
	node: {
		dot: 'bg-success-500',
		tile: 'border-success-200 bg-success-100 text-success-850',
		hoverBorder: 'hover:border-success-300 focus-within:border-success-300',
		bar: 'from-success-500 to-tertiary-500',
		chip: 'border-success-300 bg-success-100 text-success-850',
	},
	docker: {
		dot: 'bg-quaternary-500',
		tile: 'border-quaternary-200 bg-quaternary-100 text-quaternary-850',
		hoverBorder: 'hover:border-quaternary-300 focus-within:border-quaternary-300',
		bar: 'from-quaternary-500 to-secondary-500',
		chip: 'border-quaternary-300 bg-quaternary-100 text-quaternary-850',
	},
};
