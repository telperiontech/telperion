import type { AnchorHTMLAttributes } from 'react';

/** Anchor that opens in a new tab with safe `rel` defaults */
export function ExternalLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
	return <a target="_blank" rel="noopener noreferrer" {...props} />;
}
