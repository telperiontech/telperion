import { useMemo } from 'react';
import { Icon } from '@osw/react';
import { detectSupport, isFullySupported } from './detect-support';

/** Warns when this browser cannot render paintlets, so blank canvases are not mistaken for bugs */
export function SupportNotice({ className = '' }: { className?: string }) {
	const report = useMemo(detectSupport, []);

	if (isFullySupported(report)) return null;

	const missing = !report.paintApi ? 'the CSS Paint API' : 'CSS custom functions (@function)';

	return (
		<div role="status" className={`flex gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-900 ${className}`}>
			<Icon name="warning" size={20} className="shrink-0" />
			<p>
				This browser does not support {missing}, so the previews below stay blank.
				Open this page in a recent Chromium browser (Chrome or Edge) to see the paintlets in action.
			</p>
		</div>
	);
}
