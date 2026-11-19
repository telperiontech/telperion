import { useId, useState } from 'react';
import type { ReactiveStorage } from '@telperion/reactive-storage/reactive-storage';
import { DEMO_STORE } from './demo-storage';
import { actionClass, fieldClass } from './styles';

type WriteMethod = 'set' | 'patch' | 'push' | 'drop' | 'delete';

/** Methods that take a value, in button order */
const VALUE_METHODS = ['patch', 'push', 'drop'] as const;

/** What a write did, for the "last call" line: the code and how it ended */
export interface WriteCall {
	code: string;
	error?: string;
}

interface WritePanelProps {
	storage: ReactiveStorage;
	onCall: (call: WriteCall) => void;
}

const quote = (text: string) => `'${text.replace(/'/g, "\\'")}'`;

function callCode(method: WriteMethod, key: string, valueText: string): string {
	const args = [quote(DEMO_STORE), quote(key)];

	if (method !== 'delete') args.push(valueText.trim());

	return `await storage.${method}(${args.join(', ')});`;
}

/** Key path and JSON value inputs, with the write methods as buttons */
export function WritePanel({ storage, onCall }: WritePanelProps) {
	const id = useId();
	const [key, setKey] = useState('profile.name');
	const [valueText, setValueText] = useState('"Ada"');
	const [busy, setBusy] = useState(false);
	const run = async (method: WriteMethod) => {
		const code = callCode(method, key, valueText);
		let value: unknown;

		if (method !== 'delete') {
			try {
				value = JSON.parse(valueText);
			} catch {
				onCall({ code, error: 'The value is not valid JSON' });

				return;
			}
		}

		setBusy(true);

		try {
			if (method === 'delete') await storage.delete(DEMO_STORE, key);
			else if (method === 'patch') await storage.patch(DEMO_STORE, key, value as Record<string, unknown>);
			else await storage[method](DEMO_STORE, key, value);

			onCall({ code });
		} catch (error) {
			onCall({ code, error: error instanceof Error ? error.message : String(error) });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="grid gap-3 p-4">
			<div className="grid gap-1.5">
				<label htmlFor={`${id}-key`} className="text-xs font-semibold text-neutral-990">Key path</label>
				<input id={`${id}-key`} value={key} spellCheck={false} onChange={(event) => setKey(event.target.value)} className={fieldClass} />
				<p className="text-xs text-neutral-850">Dot-separated, inside the <code className="font-mono">{DEMO_STORE}</code> store. Empty means the whole store.</p>
			</div>
			<div className="grid gap-1.5">
				<label htmlFor={`${id}-value`} className="text-xs font-semibold text-neutral-990">Value (JSON)</label>
				<textarea id={`${id}-value`} value={valueText} rows={3} spellCheck={false} onChange={(event) => setValueText(event.target.value)} className={fieldClass} />
			</div>
			<div className="flex flex-wrap gap-2">
				<button type="button" disabled={busy} onClick={() => run('set')} className={actionClass(true)}>set</button>
				{VALUE_METHODS.map((method) => (
					<button key={method} type="button" disabled={busy} onClick={() => run(method)} className={actionClass()}>{method}</button>
				))}
				<button type="button" disabled={busy} onClick={() => run('delete')} className={actionClass()}>delete</button>
			</div>
		</div>
	);
}
