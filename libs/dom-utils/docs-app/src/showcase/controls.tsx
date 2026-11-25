import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Small action button shared by the demos */
export function DemoButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			{...props}
			className={`rounded-md border border-neutral-40 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 transition-colors hover:border-neutral-110 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
		/>
	);
}

/** Labelled checkbox shared by the demos */
export function DemoCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-neutral-660">
			<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-secondary-550" />
			{children}
		</label>
	);
}

/** Titled pane inside a demo frame */
export function DemoPane({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
	return (
		<div className="min-w-0 flex-1 p-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-550">{title}</h3>
				{aside}
			</div>
			{children}
		</div>
	);
}
