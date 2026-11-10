interface BooleanControlProps {
	id: string;
	value: boolean;
	onChange: (value: boolean) => void;
}

export function BooleanControl({ id, value, onChange }: BooleanControlProps) {
	return (
		<input
			id={id}
			type="checkbox"
			checked={value}
			onChange={(event) => onChange(event.target.checked)}
			className="size-4 accent-secondary-600"
		/>
	);
}
