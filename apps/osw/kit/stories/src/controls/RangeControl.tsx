import { NumberControl } from './NumberControl';
import { fieldBase } from './styles';

interface RangeControlProps {
	id: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
}

export function RangeControl({ id, value, min, max, step, onChange }: RangeControlProps) {
	return (
		<div className="flex items-center gap-3">
			<input
				id={id}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(event.target.valueAsNumber)}
				className="min-w-0 flex-1 accent-secondary-600"
			/>
			<NumberControl
				aria-label="Exact value"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={onChange}
				className={`${fieldBase} w-20 shrink-0 text-right`}
			/>
		</div>
	);
}
