import { navigate } from './navigation';

const isPlainClick = (event: MouseEvent) =>
	event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function findAnchor(event: MouseEvent): HTMLAnchorElement | undefined {
	// composedPath() also sees anchors rendered inside shadow roots
	return event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
}

/** Whether a click on `anchor` should become a client-side navigation */
function shouldIntercept(anchor: HTMLAnchorElement): boolean {
	if (!anchor.href || anchor.target || anchor.hasAttribute('download')) return false;
	if (anchor.hasAttribute('data-native-link')) return false;

	const url = new URL(anchor.href, window.location.href);
	if (url.origin !== window.location.origin) return false;

	// In-page anchors (`#section`) keep native scrolling behaviour
	const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
	return !(samePage && url.hash);
}

/**
 * Turns plain same-origin `<a href>` clicks anywhere under `root` into client-side navigations,
 * so remotes can render ordinary anchors whatever framework they use.
 *
 * Skipped: modified clicks (new tab, …), `target`/`download` links, other origins, in-page
 * hash links, handlers that already called `preventDefault()`, and `data-native-link` anchors.
 * Returns a function that removes the listener.
 */
export function interceptLinks(root: Document | HTMLElement = document): () => void {
	const onClick = (event: Event) => {
		const mouseEvent = event as MouseEvent;
		if (mouseEvent.defaultPrevented || !isPlainClick(mouseEvent)) return;

		const anchor = findAnchor(mouseEvent);
		if (!anchor || !shouldIntercept(anchor)) return;

		mouseEvent.preventDefault();
		navigate(anchor.href);
	};

	root.addEventListener('click', onClick);
	return () => root.removeEventListener('click', onClick);
}
