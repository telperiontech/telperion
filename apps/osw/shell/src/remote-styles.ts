import { getInstance } from '@module-federation/enhanced/runtime';

/**
 * Every remote ships its own Tailwind build, and the federation runtime appends it as a
 * global `<link>` it never removes. Utilities of equal specificity resolve by sheet order,
 * so a stale remote sheet breaks pages it doesn't belong to: its `.hidden` beats the shell's
 * `sm:inline`, its `.grid-cols-1` beats another remote's `lg:grid-cols-*`, and so on.
 *
 * So a remote's sheets are enabled only while one of its host elements is connected.
 */

/** Connected host elements per remote name; a remote's sheets are enabled while this is > 0 */
const mounted = new Map<string, number>();

/** Base URL the remote is served from (its manifest's folder), to recognize its stylesheets */
function remoteBaseUrl(remoteName: string): string | undefined {
	const remote = getInstance()?.options.remotes.find((r) => r.name === remoteName);
	const entry = remote && 'entry' in remote ? remote.entry : undefined;

	return entry ? new URL('.', new URL(entry, document.baseURI)).href : undefined;
}

function remoteStylesheets(remoteName: string): HTMLLinkElement[] {
	const base = remoteBaseUrl(remoteName);
	if (!base) return [];

	return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((link) => link.href.startsWith(base));
}

function whenLoaded(link: HTMLLinkElement): Promise<void> {
	if (link.sheet) return Promise.resolve();

	return new Promise((resolve) => {
		link.addEventListener('load', () => resolve(), { once: true });
		// A failed sheet shouldn't keep the remote from mounting
		link.addEventListener('error', () => resolve(), { once: true });
	});
}

/**
 * Enables or disables the remote's sheets to match whether any of its hosts is connected.
 * Toggles `CSSStyleSheet.disabled` rather than `link.disabled`: the latter drops the parsed
 * sheet, and re-enabling it fires no `load`, so there'd be nothing to wait for.
 */
function syncRemoteStyles(remoteName: string): HTMLLinkElement[] {
	const enabled = (mounted.get(remoteName) ?? 0) > 0;
	const links = remoteStylesheets(remoteName);

	links.forEach((link) => {
		if (link.sheet) link.sheet.disabled = !enabled;
		// Not parsed yet: apply whatever state is current once it is
		else link.addEventListener('load', () => syncRemoteStyles(remoteName), { once: true });
	});

	return links;
}

/** Marks a host of the remote as connected; the returned function marks it disconnected */
export function retainRemoteStyles(remoteName: string): () => void {
	mounted.set(remoteName, (mounted.get(remoteName) ?? 0) + 1);
	syncRemoteStyles(remoteName);

	let released = false;

	return () => {
		if (released) return;
		released = true;
		mounted.set(remoteName, (mounted.get(remoteName) ?? 1) - 1);
		syncRemoteStyles(remoteName);
	};
}

/**
 * Enables the remote's sheets (call after `loadRemote`, which attaches them) and resolves once
 * they're loaded. The runtime doesn't wait for them, so mounting earlier renders the remote
 * with whatever other sheets are on the page (e.g. a one-column grid before `lg:` arrives).
 */
export async function remoteStylesReady(remoteName: string): Promise<void> {
	await Promise.all(syncRemoteStyles(remoteName).map(whenLoaded));
}
