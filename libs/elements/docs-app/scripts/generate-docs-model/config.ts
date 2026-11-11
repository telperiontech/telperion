import { join } from 'node:path';

export const WORKSPACE_ROOT = join(__dirname, '../../../../..');
export const LIB_ROOT = 'libs/elements';
export const MANIFEST_PATH = `${LIB_ROOT}/custom-elements.json`;
export const PROJECT_JSON_PATH = `${LIB_ROOT}/project.json`;
export const PACKAGE_NAME = '@telperion/elements';
export const TAG_PREFIX = 'elements-v';
export const DEFAULT_OUT = `${LIB_ROOT}/docs-app/src/generated/elements-model.json`;

interface EntryMeta {
	title: string;
	summary: string;
}

/** Display order and copy for entry points; unknown entries are appended with a generated title */
export const ENTRY_META: Record<string, EntryMeta> = {
	button: { title: 'Button', summary: 'A form-associated button with palette-driven colors and four variants.' },
	select: { title: 'Select', summary: 'A form-associated selectbox with single and multiple selection.' },
	popover: { title: 'Popover', summary: 'A popover anchored with CSS anchor positioning, on top of the Popover API.' },
	'details-set': { title: 'Details Set', summary: 'Groups `<details>` elements into accordions with a cap on how many stay open.' },
	icon: { title: 'Icon', summary: 'Material Symbols, Simple Icons and theSVG icons from one element.' },
	'drag-drop': { title: 'Drag & Drop', summary: 'Draggable elements, handles and drop zones with typed events.' },
	router: { title: 'Router', summary: 'A declarative client-side router: routes, outlets, links and params as elements.' },
};

/** README sections the generated API reference replaces (matched case-insensitively) */
export const API_SECTION_HEADINGS = ['attributes', 'properties', 'methods', 'events', 'slots', 'css custom properties', 'css parts', 'api', 'api reference'];

/** Lit and platform callbacks: implementation details, not API */
export const HIDDEN_MEMBERS = new Set([
	'render',
	'styles',
	'connectedCallback',
	'disconnectedCallback',
	'adoptedCallback',
	'attributeChangedCallback',
	'createRenderRoot',
	'firstUpdated',
	'updated',
	'willUpdate',
	'update',
	'shouldUpdate',
	'getUpdateComplete',
	'performUpdate',
	'scheduleUpdate',
	'formAssociatedCallback',
	'formResetCallback',
	'formDisabledCallback',
	'formStateRestoreCallback',
]);
