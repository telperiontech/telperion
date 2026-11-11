import type { ReactNode } from 'react';
import type { OswSlot } from '@osw/core';

interface ShellSlotProps {
	/** Shell outlet to render into, from `OSW_SLOTS` */
	name: OswSlot;
	children: ReactNode;
}

/**
 * Renders `children` into one of the shell's header/footer outlets through `<tp-portal>`.
 * The content leaves the remote's React root, so React event handlers (`onClick`, …) don't
 * fire there: use plain links, which the shell turns into client-side navigations.
 */
export function ShellSlot({ name, children }: ShellSlotProps) {
	return <tp-portal name={name}>{children}</tp-portal>;
}
