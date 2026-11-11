import { toHex } from './color';
import { fieldClass } from './styles';

interface ColorControlProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
}

/** Native picker for quick changes plus a text field for any CSS color (names, `rgba()`, …) */
export function ColorControl({ id, value, onChange }: ColorControlProps) {
	return (
		<div className="flex items-center gap-2">
			<label
				className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-neutral-100 shadow-inner"
				style={{ background: value }}
			>
				<span className="sr-only">Pick a color</span>
				<input
					type="color"
					value={toHex(value) ?? '#000000'}
					onChange={(event) => onChange(event.target.value)}
					className="absolute inset-0 size-full cursor-pointer opacity-0"
				/>
			</label>
			<input id={id} type="text" value={value} spellCheck={false} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
		</div>
	);
}
