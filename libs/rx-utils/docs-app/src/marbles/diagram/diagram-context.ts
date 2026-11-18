import { createContext, useContext } from 'react';
import type { Colorer } from '../model/colors';
import type { TimeScale } from '../model/geometry';

export interface DiagramContextValue {
	scale: TimeScale;
	colorer: Colorer;
	/** Nearest frame under a pointer's `clientX` */
	toFrame: (clientX: number) => number;
	/** Playhead frame; events after it are dimmed (inputs) or hidden (outputs) */
	time: number;
}

export const DiagramContext = createContext<DiagramContextValue | null>(null);

export function useDiagram(): DiagramContextValue {
	const value = useContext(DiagramContext);

	if (!value) throw new Error('useDiagram() must be used inside <MarbleDiagram>');

	return value;
}
