import { ecosystemById, ecosystems, type Ecosystem, type EcosystemId, type Library } from '../data';

export type EcosystemFilter = EcosystemId | 'all';

export interface LibraryGroup {
	ecosystem: Ecosystem;
	libraries: Library[];
}

const matches = (library: Library, query: string) => {
	if (!query) return true;
	const haystack = [library.name, library.tagline, library.description, ecosystemById(library.ecosystem).label]
		.join(' ')
		.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.every((term) => haystack.includes(term));
};

/** Filters by ecosystem + free-text query and groups the result by ecosystem (empty groups dropped). */
export function groupLibraries(libraries: Library[], filter: EcosystemFilter, query: string): LibraryGroup[] {
	const trimmed = query.trim();
	return ecosystems
		.filter((ecosystem) => filter === 'all' || ecosystem.id === filter)
		.map((ecosystem) => ({
			ecosystem,
			libraries: libraries.filter((lib) => lib.ecosystem === ecosystem.id && matches(lib, trimmed)),
		}))
		.filter((group) => group.libraries.length > 0);
}
