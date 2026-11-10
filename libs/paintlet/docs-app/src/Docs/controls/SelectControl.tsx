import { fieldClass } from './styles';

interface SelectControlProps {
	id: string;
	value: string;
	options: readonly string[];
	onChange: (value: string) => void;
}

export function SelectControl({ id, value, options, onChange }: SelectControlProps) {
	return (
		<select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
			{options.map((option) => (
				<option key={option} value={option}>{option}</option>
			))}
		</select>
	);
}
