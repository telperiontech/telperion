import { ReactiveCookieStorage } from '@telperion/reactive-storage/reactive-cookie-storage';
import type { ReactiveStorage } from '@telperion/reactive-storage/reactive-storage';
import { ReactiveWebLocalStorage } from '@telperion/reactive-storage/reactive-web-local-storage';
import { ReactiveWebSessionStorage } from '@telperion/reactive-storage/reactive-web-session-storage';

export type DemoKind = 'local' | 'session' | 'cookie';

/**
 * App namespace of every demo storage. The docs run on the shell's origin, so the demo keeps to
 * its own keys (`osw_demo/demo`, cookie `osw_demo_demo`) and never touches the site's own data.
 */
export const DEMO_APP = 'osw_demo';
/** The one store the playground reads and writes */
export const DEMO_STORE = 'demo';

/** Short-lived, site-wide demo cookie */
const COOKIE_OPTIONS = { path: '/', maxAge: 60 * 60, sameSite: 'strict' } as const;

export interface DemoStorages {
	storage: ReactiveStorage;
	/** A second cookie storage linked to `storage`, to show linked instances */
	linked?: ReactiveStorage;
	/** Releases the instances when the playground unmounts */
	dispose: () => void;
}

export function createDemoStorages(kind: DemoKind): DemoStorages {
	if (kind === 'cookie') {
		const linker = Symbol('osw-demo');
		const storage = new ReactiveCookieStorage(DEMO_APP, COOKIE_OPTIONS, linker);
		const linked = new ReactiveCookieStorage(DEMO_APP, COOKIE_OPTIONS, linker);

		return { storage, linked, dispose: () => [storage, linked].forEach((instance) => instance.destroy()) };
	}

	const storage = kind === 'local' ? new ReactiveWebLocalStorage(DEMO_APP) : new ReactiveWebSessionStorage(DEMO_APP);

	return { storage, dispose: () => undefined };
}

/** Where the store lives, as a reader would look it up in devtools */
export function rawLocation(kind: DemoKind): string {
	if (kind === 'cookie') return `document.cookie → ${DEMO_APP}_${DEMO_STORE}`;

	return `${kind === 'local' ? 'localStorage' : 'sessionStorage'} → ${DEMO_APP}/${DEMO_STORE}`;
}

/** The stored text exactly as the browser keeps it, or `null` when the store does not exist */
export function readRaw(kind: DemoKind): string | null {
	if (kind !== 'cookie') return (kind === 'local' ? localStorage : sessionStorage).getItem(`${DEMO_APP}/${DEMO_STORE}`);

	const prefix = `${DEMO_APP}_${DEMO_STORE}=`;
	const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));

	return cookie ? cookie.slice(prefix.length) : null;
}
