import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './navigation';

interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	href: string;
}

const isPlainClick = (event: MouseEvent) =>
	event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Same-site link that navigates client-side; modified clicks keep native behaviour (new tab, …) */
export function AppLink({ href, onClick, ...props }: AppLinkProps) {
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || !isPlainClick(event) || props.target) return;

		event.preventDefault();
		navigate(href);
	};

	return <a href={href} onClick={handleClick} {...props} />;
}
