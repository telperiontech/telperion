/**
 * Framework-agnostic building blocks of the Open Source Website (osw):
 * navigation, link interception, the remote contract and the shared custom elements.
 * Framework adapters (e.g. `@osw/react`) build on top of this.
 */
export { navigate, onNavigate } from './navigation';
export { interceptLinks } from './links';
export type { OswRemote, OswUnmount } from './remote';
export { OSW_SLOTS, type OswSlot } from './shell-slots';
export { OswCopyButton, OswTreeMark, defineOswElements } from './elements';

declare global {
	interface HTMLElementTagNameMap {
		'osw-copy-button': import('./elements').OswCopyButton;
		'osw-tree-mark': import('./elements').OswTreeMark;
	}
}
