import generated from '../../generated/docs-model.json';
import type { DocsCategory, DocsEntry, DocsModel } from './types';

export const model = generated as DocsModel;

const entriesById = new Map(model.entries.map((entry) => [entry.id, entry]));
const categoriesById = new Map(model.categories.map((category) => [category.id, category]));

export const getEntry = (id: string): DocsEntry | undefined => entriesById.get(id);
export const getCategory = (id: string): DocsCategory | undefined => categoriesById.get(id);

export const entriesOf = (category: DocsCategory): DocsEntry[] =>
	category.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is DocsEntry => !!entry);
