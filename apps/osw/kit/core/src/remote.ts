/** Tears a mounted remote down; called when the shell removes the remote's host element */
export type OswUnmount = () => void;

/**
 * Contract every osw remote's exposed module implements, whatever framework renders it.
 * The shell creates a host element per route and calls `bootstrap` with it on connect.
 */
export interface OswRemote {
	bootstrap(element: HTMLElement): OswUnmount | Promise<OswUnmount>;
}
