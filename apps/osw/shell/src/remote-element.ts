import { loadRemote } from '@module-federation/enhanced/runtime';

interface RemoteModule {
	bootstrap(element: HTMLElement): Promise<() => void> | (() => void);
}

/**
 * Defines a custom element that mounts a federated module's `bootstrap` export on connect
 * and calls the returned cleanup on disconnect (e.g. when `<tha-router>` swaps routes).
 */
export function defineRemoteElement(tagName: string, remoteModule: string): void {
	class RemoteElement extends HTMLElement {
		#unmount?: () => void;
		/** Guards against a disconnect arriving before the remote finished loading */
		#generation = 0;

		connectedCallback() {
			const generation = ++this.#generation;

			loadRemote<RemoteModule>(remoteModule)
				.then((module) => module?.bootstrap(this))
				.then((unmount) => {
					if (generation === this.#generation) this.#unmount = unmount;
					else unmount?.();
				})
				.catch((err) => console.error(`Error loading remote module ${remoteModule}:`, err));
		}

		disconnectedCallback() {
			this.#generation++;
			this.#unmount?.();
			this.#unmount = undefined;
		}
	}

	customElements.define(tagName, RemoteElement);
}
