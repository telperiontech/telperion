import type { ReactNode } from 'react';
import { Icon } from '@osw/react';

interface PanelActionProps {
	icon: string;
	children: ReactNode;
	disabled?: boolean;
	onClick: () => void;
}

/** A small text button for a `Panel` header (reset, clear, …) */
export function PanelAction({ icon, children, disabled, onClick }: PanelActionProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-920 transition-colors hover:bg-neutral-50 hover:text-neutral-990 disabled:pointer-events-none disabled:opacity-40"
		>
			<Icon name={icon} size={16} />
			{children}
		</button>
	);
}
