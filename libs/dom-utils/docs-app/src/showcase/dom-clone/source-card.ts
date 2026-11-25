/**
 * The demo's source element, built and changed with plain DOM calls (outside React) so every
 * change is a real mutation: exactly what DomClone observes.
 */
const template = `
	<h4 class="text-sm font-semibold">Order #1042</h4>
	<p class="mt-1 text-xs text-neutral-660">Status: <span class="font-medium text-neutral-900">pending</span></p>
	<ul class="mt-3 space-y-1 text-xs">
		<li class="rounded bg-neutral-20 px-2 py-1">Item 1</li>
		<li class="rounded bg-neutral-20 px-2 py-1">Item 2</li>
	</ul>
`;
const cardClass =
	'block rounded-lg border border-neutral-40 bg-white p-4 shadow-sm transition-colors data-[state=active]:border-secondary-400 data-[state=active]:bg-secondary-30';
const itemClass = 'rounded bg-neutral-20 px-2 py-1';
const statuses = ['pending', 'packed', 'shipped', 'delivered'];
const colors = ['var(--color-tertiary-700)', 'var(--color-danger-600)', 'var(--color-quaternary-700)', ''];

export interface SourceCard {
	element: HTMLElement;
	/** `data-state` attribute: an `attributes` mutation */
	toggleState(): void;
	/** Inline `style` attribute: an `attributes` mutation */
	recolor(): void;
	/** Text node value of the status: a `characterData` mutation */
	nextStatus(): void;
	/** A `childList` mutation on the list */
	addItem(): void;
	/** A `childList` mutation on the list */
	removeItem(): void;
}

export function createSourceCard(): SourceCard {
	const element = document.createElement('article');

	element.className = cardClass;
	element.dataset['state'] = 'idle';
	element.innerHTML = template;

	const statusText = element.querySelector('span')!.firstChild as Text;
	const list = element.querySelector('ul')!;
	let status = 0;
	let color = 0;
	let items = list.children.length;

	return {
		element,
		toggleState: () => {
			element.dataset['state'] = element.dataset['state'] === 'active' ? 'idle' : 'active';
		},
		recolor: () => {
			element.style.color = colors[color++ % colors.length];
		},
		nextStatus: () => {
			statusText.data = statuses[++status % statuses.length];
		},
		addItem: () => {
			const item = document.createElement('li');

			item.className = itemClass;
			item.textContent = `Item ${++items}`;
			list.append(item);
		},
		removeItem: () => list.lastElementChild?.remove(),
	};
}
