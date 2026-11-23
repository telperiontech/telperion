import type { ReactNode } from 'react';

const tones = {
	neutral: 'border-neutral-40 bg-neutral-10 text-neutral-660',
	primary: 'border-primary-150 bg-primary-70 text-primary-710',
	secondary: 'border-secondary-150 bg-secondary-70 text-secondary-710',
};

/** Small rounded label: `required`, an HTTP method, a status code */
export function Pill({ tone = 'neutral', mono = false, children }: { tone?: keyof typeof tones; mono?: boolean; children: ReactNode }) {
	return (
		<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${mono ? 'font-mono' : ''} ${tones[tone]}`}>
			{children}
		</span>
	);
}
