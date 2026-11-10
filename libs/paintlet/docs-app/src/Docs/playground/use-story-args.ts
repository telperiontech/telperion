import { useCallback, useEffect, useMemo, useState } from 'react';
import { argsFromSearch, changedArgs, searchFromArgs, type Args, type StoryDoc } from '../stories';

/** Delay before edits are mirrored to the URL, so dragging a slider does not flood history */
const URL_SYNC_DELAY = 200;

/**
 * Args of the open story: seeded from the query string, kept in the URL with
 * `replaceState` so the current setup can be shared as a link.
 * Mount once per story (key the consumer by story) to start from that story's args.
 */
export function useStoryArgs(story: StoryDoc) {
	const [args, setArgs] = useState<Args>(() => argsFromSearch(window.location.search, story.args));

	useEffect(() => {
		const timer = setTimeout(() => {
			const search = searchFromArgs(args, story.args);

			if (search === window.location.search) return;

			const url = `${window.location.pathname}${search}${window.location.hash}`;
			window.history.replaceState(window.history.state, '', url);
		}, URL_SYNC_DELAY);

		return () => clearTimeout(timer);
	}, [args, story]);

	const update = useCallback((name: string, value: unknown) => setArgs((current) => ({ ...current, [name]: value })), []);
	const reset = useCallback(() => setArgs(story.args), [story]);
	const changed = useMemo(() => changedArgs(args, story.args), [args, story]);

	return { args, update, reset, changed };
}
