import type { Control } from '../core';
import { BooleanControl } from './BooleanControl';
import { ColorControl } from './ColorControl';
import { NumberControl } from './NumberControl';
import { RangeControl } from './RangeControl';
import { SelectControl } from './SelectControl';
import { TextControl } from './TextControl';

interface ControlInputProps {
	id: string;
	control: Control;
	value: unknown;
	onChange: (value: unknown) => void;
}

/** Picks the input for a control kind */
export function ControlInput({ id, control, value, onChange }: ControlInputProps) {
	switch (control.kind) {
		case 'range':
			return <RangeControl id={id} value={Number(value ?? control.min)} min={control.min} max={control.max} step={control.step} onChange={onChange} />;
		case 'number':
			return <NumberControl id={id} value={Number(value ?? 0)} min={control.min} max={control.max} step={control.step} onChange={onChange} />;
		case 'color':
			return <ColorControl id={id} value={String(value ?? '')} onChange={onChange} />;
		case 'select':
			return <SelectControl id={id} value={String(value ?? '')} options={control.options} onChange={onChange} />;
		case 'boolean':
			return <BooleanControl id={id} value={Boolean(value)} onChange={onChange} />;
		default:
			return <TextControl id={id} value={String(value ?? '')} onChange={onChange} />;
	}
}
