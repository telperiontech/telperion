import { HomeSection } from '@osw/docs';
import { paintlets } from '../stories';
import { SupportNotice } from '../support';
import { GalleryTile } from './GalleryTile';

export function Gallery() {
	return (
		<HomeSection id="gallery" title="Paintlets" intro="Every preview is live. Open one to change its settings and copy the CSS for what you see.">
			<SupportNotice className="mt-6" />
			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{paintlets.map((paintlet) => (
					<GalleryTile key={paintlet.id} paintlet={paintlet} />
				))}
			</div>
		</HomeSection>
	);
}
