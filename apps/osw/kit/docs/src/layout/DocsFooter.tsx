import type { ReactNode } from 'react';
import { OSW_SLOTS } from '@osw/core';
import { ShellSlot } from '@osw/react';

/** Puts a remote-specific note (`children`) into the shell footer's bottom bar */
export function DocsFooter({ children }: { children: ReactNode }) {
	return (
		<ShellSlot name={OSW_SLOTS.footerNote}>
			<p>{children}</p>
		</ShellSlot>
	);
}
