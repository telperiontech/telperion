import { SupportTable } from '../support';

export function BrowserSupport() {
	return (
		<section aria-labelledby="support-title" className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_32rem]">
			<div>
				<h2 id="support-title" className="text-2xl font-semibold tracking-tight">Browser support</h2>
				<p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-920">
					Paintlets need the CSS Paint API and CSS custom functions, available in recent Chromium browsers.
					Elsewhere the declarations are ignored, so give elements a fallback background
					(declare it first, then the paintlet) and they degrade gracefully.
				</p>
				<p className="mt-3 text-sm text-neutral-920">The table shows what <em>your</em> browser supports right now.</p>
			</div>
			<SupportTable />
		</section>
	);
}
