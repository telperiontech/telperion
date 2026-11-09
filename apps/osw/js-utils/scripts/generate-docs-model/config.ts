import { join } from 'node:path';

export const WORKSPACE_ROOT = join(__dirname, '../../../../..');
export const LIB_ROOT = 'libs/js-utils';
export const SOURCE_ROOT = `${LIB_ROOT}/src`;
export const TSCONFIG_PATH = `${LIB_ROOT}/tsconfig.lib.json`;
export const PACKAGE_NAME = '@telperion/js-utils';
export const TAG_PREFIX = 'js-utils-v';

/** Root-level modules (`@telperion/js-utils/limit`) are grouped under this category */
export const ROOT_CATEGORY = 'core';

interface CategoryMeta {
	title: string;
	description: string;
}

/** Display order and copy for categories; unknown folders are appended with a generated title */
export const CATEGORY_META: Record<string, CategoryMeta> = {
	core: { title: 'Core', description: 'General-purpose helpers and data structures.' },
	array: { title: 'Array', description: 'Set-like operations, async mapping, slicing and de-duplication for arrays.' },
	object: { title: 'Object', description: 'Deep cloning, freezing, mapping and compacting objects.' },
	function: { title: 'Function', description: 'Debouncing, deferring and composing functions.' },
	promise: { title: 'Promise', description: 'Timeouts, chaining, error tuples and other promise flow helpers.' },
	map: { title: 'Map', description: 'Helpers for Map instances.' },
	math: { title: 'Math', description: 'Numeric helpers.' },
	string: { title: 'String', description: 'String helpers.' },
	time: { title: 'Time', description: 'Readable duration constants in milliseconds.' },
	class: { title: 'Class', description: 'Class composition helpers.' },
	boolean: { title: 'Boolean', description: 'Truthiness checks.' },
	set: { title: 'Set', description: 'Helpers for Set instances.' },
};
