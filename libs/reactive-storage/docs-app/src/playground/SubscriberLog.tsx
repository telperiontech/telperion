import { Icon } from '@osw/react';
import type { ReactiveStorage } from '@telperion/reactive-storage/reactive-storage';
import { DEMO_STORE } from './demo-storage';
import { formatValue } from './styles';
import { useEmissions } from './use-emissions';

interface SubscriberLogProps {
	storage: ReactiveStorage;
	path: string;
	/** Which instance subscribes, when the playground has more than one */
	instance?: string;
	onRemove?: () => void;
}

/** One live `storage.get(...)` subscription and the values it received, newest first */
export function SubscriberLog({ storage, path, instance, onRemove }: SubscriberLogProps) {
	const emissions = useEmissions(storage, path);
	const call = `get('${DEMO_STORE}'${path ? `, '${path}'` : ''})`;

	return (
		<li className="px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<p className="min-w-0 truncate font-mono text-xs font-semibold text-neutral-900">
					{instance && <span className="mr-1.5 font-sans font-medium text-neutral-550">{instance} ·</span>}
					{call}
				</p>
				{onRemove && (
					<button type="button" onClick={onRemove} aria-label={`Unsubscribe ${call}`} className="rounded p-0.5 text-neutral-550 hover:bg-neutral-20 hover:text-neutral-900">
						<Icon name="close" size={16} />
					</button>
				)}
			</div>
			<ol className="mt-2 grid gap-1" aria-live="polite" aria-label={`Values received by ${call}, newest first`}>
				{emissions.map((emission, index) => (
					<li key={emission.seq} className={`flex gap-2 font-mono text-xs ${index ? 'text-neutral-550' : 'text-neutral-900'}`}>
						<span className="w-6 shrink-0 tabular-nums text-neutral-550">#{emission.seq}</span>
						<span className="min-w-0 break-all">{formatValue(emission.value)}</span>
					</li>
				))}
			</ol>
		</li>
	);
}
