import { fieldClass } from './styles';

interface TextControlProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
}

export function TextControl({ id, value, onChange }: TextControlProps) {
	return <input id={id} type="text" value={value} spellCheck={false} onChange={(event) => onChange(event.target.value)} className={fieldClass} />;
}
