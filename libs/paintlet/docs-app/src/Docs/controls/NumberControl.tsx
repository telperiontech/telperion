import { fieldClass } from './styles';

interface NumberControlProps {
	id: string;
	value: number;
	min?: number;
	max?: number;
	step?: number;
	onChange: (value: number) => void;
}

export function NumberControl({ id, value, min, max, step, onChange }: NumberControlProps) {
	return (
		<input
			id={id}
			type="number"
			min={min}
			max={max}
			step={step}
			value={value}
			onChange={(event) => Number.isFinite(event.target.valueAsNumber) && onChange(event.target.valueAsNumber)}
			className={fieldClass}
		/>
	);
}
