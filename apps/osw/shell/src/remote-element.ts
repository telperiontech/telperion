import { loadRemote } from '@module-federation/enhanced/runtime';
import type { OswRemote } from '@osw/core';
import { remoteStylesReady, retainRemoteStyles } from './remote-styles';

/**
 * Defines a custom element that mounts a federated module's `bootstrap` export on connect
 * and calls the returned cleanup on disconnect (e.g. when `<tp-router>` swaps routes).
 * The remote's stylesheets are only active while the element is connected, and the remote
 * mounts once they've loaded.
 */
export function defineRemoteElement(tagName: string, remoteModule: string): void {
	// `osw/paintlet/Docs` → `osw/paintlet`
	const remoteName = remoteModule.slice(0, remoteModule.lastIndexOf('/'));

	class RemoteElement extends HTMLElement {
		#unmount?: () => void;
		#releaseStyles?: () => void;
		/** Guards against a disconnect arriving before the remote finished loading */
		#generation = 0;

		connectedCallback() {
			const generation = ++this.#generation;
			const isCurrent = () => generation === this.#generation;

			this.#releaseStyles = retainRemoteStyles(remoteName);

			loadRemote<OswRemote>(remoteModule)
				.then(async (module) => {
					await remoteStylesReady(remoteName);
					return isCurrent() ? module?.bootstrap(this) : undefined;
				})
				.then((unmount) => {
					if (isCurrent()) this.#unmount = unmount;
					else unmount?.();
				})
				.catch((err) => console.error(`Error loading remote module ${remoteModule}:`, err));
		}

		disconnectedCallback() {
			this.#generation++;
			this.#unmount?.();
			this.#unmount = undefined;
			this.#releaseStyles?.();
			this.#releaseStyles = undefined;
		}
	}

	customElements.define(tagName, RemoteElement);
}
