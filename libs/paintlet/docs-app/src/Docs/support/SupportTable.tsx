import { useMemo } from 'react';
import { Icon } from '@osw/react';
import { detectSupport, type SupportReport } from './detect-support';

const FEATURES: { key: keyof SupportReport; label: string; detail: string; required: boolean }[] = [
	{ key: 'paintApi', label: 'CSS Paint API', detail: 'Runs the paint worklets.', required: true },
	{ key: 'customFunctions', label: 'CSS @function', detail: 'Powers the --tp-<name>() helpers.', required: true },
	{ key: 'propertyRegistration', label: '@property / registerProperty', detail: 'Typed properties make paintlets animatable.', required: false },
	{ key: 'paintArguments', label: 'paint() arguments', detail: 'Optional; custom properties are used without it.', required: false },
];

/** Live feature detection for the current browser */
export function SupportTable() {
	const report = useMemo(detectSupport, []);

	return (
		<ul className="divide-y divide-neutral-40 rounded-xl border border-neutral-40">
			{FEATURES.map(({ key, label, detail, required }) => {
				const ok = report[key];

				return (
					<li key={key} className="flex items-start gap-3 px-4 py-3">
						<span className={`mt-0.5 shrink-0 ${ok ? 'text-success-540' : required ? 'text-danger-540' : 'text-neutral-270'}`}>
							<Icon name={ok ? 'check_circle' : required ? 'cancel' : 'do_not_disturb_on'} size={20} filled />
						</span>
						<div className="min-w-0">
							<p className="text-sm font-medium">
								{label}
								{!required && <span className="ml-2 text-xs font-normal text-neutral-550">optional</span>}
							</p>
							<p className="text-xs text-neutral-550">{detail}</p>
						</div>
						<span className="ml-auto shrink-0 text-xs font-medium text-neutral-660">{ok ? 'Supported' : 'Missing'}</span>
					</li>
				);
			})}
		</ul>
	);
}
