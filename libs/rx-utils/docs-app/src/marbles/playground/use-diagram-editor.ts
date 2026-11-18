import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { AnyMarbleScenario } from '../engine';
import type { DiagramEditor } from '../diagram/editor';
import { addValue, freeFrame, moveEvent, moveWindow, removeEvent } from '../model/edit';
import { nextValue, valuePool, type EditableState } from '../model/editable';

/** Diagram edits applied to the playground state, within frames `0..limit` */
export function useDiagramEditor(scenario: AnyMarbleScenario, setState: Dispatch<SetStateAction<EditableState>>, limit: number): DiagramEditor {
	return useMemo(
		() => ({
			moveEvent: (input, id, frame) => setState((state) => moveEvent(state, input, id, frame, limit)),
			removeEvent: (input, id) => setState((state) => removeEvent(state, input, id)),
			addValue: (input, frame) =>
				setState((state) => {
					const events = state.inputs[input] ?? [];
					const spec = scenario.inputs[input];
					const value = spec ? nextValue(valuePool(spec), events) : undefined;

					return addValue(state, input, Math.min(frame ?? freeFrame(events, limit), limit), value);
				}),
			moveWindow: (index, edge, frame) => setState((state) => moveWindow(state, index, edge, frame, limit)),
		}),
		[scenario, setState, limit],
	);
}
