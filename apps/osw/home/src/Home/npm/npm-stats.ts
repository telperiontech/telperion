export interface NpmStats {
	version?: string;
	weeklyDownloads?: number;
}

const CACHE_PREFIX = 'osw-npm:';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
	at: number;
	stats: NpmStats;
}

function readCache(name: string): NpmStats | null {
	try {
		const raw = sessionStorage.getItem(CACHE_PREFIX + name);
		if (!raw) return null;
		const entry = JSON.parse(raw) as CacheEntry;
		return Date.now() - entry.at < CACHE_TTL_MS ? entry.stats : null;
	} catch {
		return null;
	}
}

function writeCache(name: string, stats: NpmStats): void {
	try {
		sessionStorage.setItem(CACHE_PREFIX + name, JSON.stringify({ at: Date.now(), stats } satisfies CacheEntry));
	} catch {
		// Storage unavailable; we'll just refetch next time.
	}
}

async function getJson<T>(url: string): Promise<T | undefined> {
	try {
		const res = await fetch(url);
		return res.ok ? ((await res.json()) as T) : undefined;
	} catch {
		return undefined;
	}
}

const inflight = new Map<string, Promise<NpmStats>>();

/** Latest version and last-week downloads from the public npm APIs (both CORS-enabled). */
export function fetchNpmStats(name: string): Promise<NpmStats> {
	const cached = readCache(name);
	if (cached) return Promise.resolve(cached);

	let pending = inflight.get(name);
	if (!pending) {
		pending = Promise.all([
			getJson<{ version: string }>(`https://registry.npmjs.org/${name}/latest`),
			getJson<{ downloads: number }>(`https://api.npmjs.org/downloads/point/last-week/${name}`),
		]).then(([latest, downloads]) => {
			const stats: NpmStats = { version: latest?.version, weeklyDownloads: downloads?.downloads };
			if (latest || downloads) writeCache(name, stats);
			inflight.delete(name);
			return stats;
		});
		inflight.set(name, pending);
	}
	return pending;
}
