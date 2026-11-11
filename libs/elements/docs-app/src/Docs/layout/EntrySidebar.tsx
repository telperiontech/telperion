import { useMemo } from 'react';
import { StorySidebar, type ComponentDoc } from '@osw/stories';
import { model } from '../model';
import { entryPath, storyPath } from '../routing';
import { storiesOf } from '../stories';

interface EntrySidebarProps {
	activeEntryId?: string;
	activeStoryId?: string;
	onNavigate?: () => void;
}

/** Entry points (linking to their docs) with their stories (linking to the playground) */
export function EntrySidebar({ activeEntryId, activeStoryId, onNavigate }: EntrySidebarProps) {
	// The kit's sidebar groups stories by component; here each entry point is one group
	const groups = useMemo<ComponentDoc[]>(
		() =>
			model.entries.map((entry) => ({
				id: entry.id,
				title: entry.title,
				path: entry.title,
				stories: storiesOf(entry).map(({ story }) => story),
			})),
		[],
	);

	return (
		<StorySidebar
			components={groups}
			label="Elements"
			componentHref={entryPath}
			storyHref={storyPath}
			activeComponentId={activeEntryId}
			activeStoryId={activeStoryId}
			onNavigate={onNavigate}
		/>
	);
}
