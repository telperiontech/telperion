import { useEffect } from 'react';
import { trackEvent } from '@osw/core';

interface NotFoundProps {
	title: string;
	backHref: string;
	backLabel: string;
	message?: string;
	/** Spacing around the block, which differs with and without a sidebar */
	className?: string;
}

/** 404 body for a docs remote; reports `page_not_found` so broken links show up in analytics */
export function NotFound({ title, backHref, backLabel, message = 'It may have been renamed or removed in this version.', className = 'py-16' }: NotFoundProps) {
	useEffect(() => trackEvent('page_not_found', { page_location: window.location.href }), []);

	return (
		<div className={`text-center ${className}`}>
			<p className="font-mono text-sm font-semibold text-primary-600">404</p>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
			<p className="mt-3 text-neutral-920">{message}</p>
			<a
				href={backHref}
				className="mt-6 inline-flex rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
			>
				{backLabel}
			</a>
		</div>
	);
}
