import { OswCopyButton } from './copy-button';
import { OswTreeMark } from './tree-mark';

const ELEMENTS = [OswCopyButton, OswTreeMark];

/**
 * Registers the osw custom elements. Idempotent, so the shell and a standalone remote
 * can both call it; the first registration wins.
 */
export function defineOswElements(): void {
	for (const element of ELEMENTS) {
		if (!customElements.get(element.tagName)) customElements.define(element.tagName, element);
	}
}
