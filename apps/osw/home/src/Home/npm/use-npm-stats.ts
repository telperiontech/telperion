import { useEffect, useState } from 'react';
import { fetchNpmStats, type NpmStats } from './npm-stats';

/** npm stats for a package; `undefined` while loading or when `name` is omitted. */
export function useNpmStats(name: string | undefined): NpmStats | undefined {
	const [stats, setStats] = useState<NpmStats>();

	useEffect(() => {
		if (!name) return;
		let active = true;
		fetchNpmStats(name).then((result) => active && setStats(result));
		return () => {
			active = false;
		};
	}, [name]);

	return stats;
}
