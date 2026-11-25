/** Nested boxes of the getParents demo; each becomes a real element in the page */
export interface TreeNode {
	id: string;
	label: string;
	children?: TreeNode[];
}

export const tree: TreeNode = {
	id: 'main',
	label: 'main',
	children: [
		{ id: 'nav', label: 'nav', children: [{ id: 'link', label: 'a.home' }] },
		{
			id: 'card',
			label: 'section.card',
			children: [
				{
					id: 'list',
					label: 'ul.items',
					children: [{ id: 'item', label: 'li.item', children: [{ id: 'action', label: 'button.remove' }] }],
				},
				{ id: 'footer', label: 'footer' },
			],
		},
	],
};

/** Label of a demo box element, from its `data-label` */
export const labelOf = (element: Element) => (element as HTMLElement).dataset['label'] ?? element.localName;
