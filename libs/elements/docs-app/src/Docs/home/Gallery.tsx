import { HomeSection } from '@osw/docs';
import { model } from '../model';
import { GalleryTile } from './GalleryTile';

export function Gallery() {
	return (
		<HomeSection id="gallery" title="Elements" intro="Every preview is live. Open one for its guide and API reference, or tweak its stories in the playground.">
			<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{model.entries.map((entry) => (
					<GalleryTile key={entry.id} entry={entry} />
				))}
			</div>
		</HomeSection>
	);
}
