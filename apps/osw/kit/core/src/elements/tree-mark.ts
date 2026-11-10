const TREE_SVG = `
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block size-full" aria-hidden="true">
	<circle cx="16" cy="12" r="9" opacity="0.35" />
	<path d="M16 29V13" />
	<path d="M16 19l-5-5M16 16l5-5M16 23l4-3" />
	<circle cx="11" cy="14" r="1.2" fill="currentColor" stroke="none" />
	<circle cx="21" cy="11" r="1.2" fill="currentColor" stroke="none" />
	<circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
</svg>`;

/**
 * `<osw-tree-mark>`: minimal silver-tree logo mark. Strokes follow `currentColor`;
 * size it with utilities on the host (e.g. `class="size-7 text-secondary-600"`).
 */
export class OswTreeMark extends HTMLElement {
	static readonly tagName = 'osw-tree-mark';

	connectedCallback(): void {
		this.classList.add('inline-block', 'shrink-0');
		this.setAttribute('aria-hidden', 'true');
		if (!this.firstElementChild) this.innerHTML = TREE_SVG;
	}
}
