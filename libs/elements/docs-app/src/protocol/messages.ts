/**
 * postMessage protocol between the docs remote (inside the shell) and `preview.html`
 * (an iframe on the remote's own origin that runs the stories).
 *
 * Stories run in the iframe because they define custom elements: the shell already
 * registers some of them (`<tha-router>`, `<tp-icon>`) from its own copy of the library,
 * and a second `customElements.define` of the same tag throws. The iframe also isolates
 * the elements' document-level styles from the docs' Tailwind preflight, and the other way around.
 */

/** Primitive arg values that survive structured cloning and URLs */
export type ArgValue = string | number | boolean;

/** Parent → preview: render a story; args are the overrides of the story's defaults */
export interface RenderMessage {
	type: 'osw-preview:render';
	componentId: string;
	storyId: string;
	args: Record<string, ArgValue>;
	/** Event names to log back to the parent */
	events: string[];
}

/** Preview → parent: the iframe's script is ready for `render` messages */
export interface ReadyMessage {
	type: 'osw-preview:ready';
}

/** Preview → parent: rendered content height, for sizing the iframe */
export interface SizeMessage {
	type: 'osw-preview:size';
	height: number;
}

/** Preview → parent: one of the requested events fired */
export interface EventMessage {
	type: 'osw-preview:event';
	name: string;
	/** `<tag>` of the event target */
	target: string;
	/** Short, printable summary of `detail` / `value` */
	summary?: string;
}

export interface ErrorMessage {
	type: 'osw-preview:error';
	message: string;
}

export type ParentMessage = RenderMessage;
export type PreviewMessage = ReadyMessage | SizeMessage | EventMessage | ErrorMessage;

const PREFIX = 'osw-preview:';

export const isPreviewMessage = (data: unknown): data is PreviewMessage =>
	typeof data === 'object' && data !== null && String((data as { type?: unknown }).type).startsWith(PREFIX);

export const isRenderMessage = (data: unknown): data is RenderMessage =>
	typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'osw-preview:render';

/** Only primitive args are sent; objects and functions stay with the story's own defaults */
export function primitiveArgs(args: Record<string, unknown>): Record<string, ArgValue> {
	return Object.fromEntries(
		Object.entries(args).filter((entry): entry is [string, ArgValue] => ['string', 'number', 'boolean'].includes(typeof entry[1])),
	);
}
