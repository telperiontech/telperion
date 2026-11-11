import generated from '../../generated/elements-model.json';
import type { ElementsModel, EntryDoc } from './types';

export const model = generated as ElementsModel;

const entriesById = new Map(model.entries.map((entry) => [entry.id, entry]));
const entriesByTag = new Map(model.entries.flatMap((entry) => entry.elements.map((element) => [element.tagName, entry] as const)));

export const getEntry = (id: string): EntryDoc | undefined => entriesById.get(id);

/** Entry point that defines `<tagName>` */
export const entryOfTag = (tagName: string): EntryDoc | undefined => entriesByTag.get(tagName);

export const INSTALL_COMMAND = `pnpm add ${model.packageName}`;

/** Native events worth logging for any element, on top of the ones the manifest documents */
const COMMON_EVENTS = ['change', 'input', 'submit', 'reset'];

/** Event names the playground logs for an entry */
export const eventsOf = (entry: EntryDoc): string[] => [
	...new Set([...entry.elements.flatMap((element) => element.events.map((event) => event.name)).filter(Boolean), ...COMMON_EVENTS]),
];
