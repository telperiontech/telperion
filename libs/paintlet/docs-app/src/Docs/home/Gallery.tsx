import { paintlets } from '../stories';
import { SupportNotice } from '../support';
import { GalleryTile } from './GalleryTile';

export function Gallery() {
	return (
		<section aria-labelledby="gallery-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
			<h2 id="gallery-title" className="text-2xl font-semibold tracking-tight">Paintlets</h2>
			<p className="mt-2 max-w-2xl text-sm text-neutral-920">
				Every preview is live. Open one to change its settings and copy the CSS for what you see.
			</p>
			<SupportNotice className="mt-6" />
			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{paintlets.map((paintlet) => (
					<GalleryTile key={paintlet.id} paintlet={paintlet} />
				))}
			</div>
		</section>
	);
}
