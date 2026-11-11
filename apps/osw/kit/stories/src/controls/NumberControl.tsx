import { fieldClass } from './styles';

interface NumberControlProps {
	id?: string;
	value: number;
	min?: number;
	max?: number;
	step?: number;
	onChange: (value: number) => void;
	/** For a field without a `<label for>` */
	'aria-label'?: string;
	className?: string;
}

/** A number field that ignores partial input (`-`, `1e`) instead of reporting `NaN` */
export function NumberControl({ id, value, min, max, step, onChange, 'aria-label': ariaLabel, className = fieldClass }: NumberControlProps) {
	return (
		<input
			id={id}
			type="number"
			aria-label={ariaLabel}
			min={min}
			max={max}
			step={step}
			value={value}
			onChange={(event) => Number.isFinite(event.target.valueAsNumber) && onChange(event.target.valueAsNumber)}
			className={className}
		/>
	);
}
