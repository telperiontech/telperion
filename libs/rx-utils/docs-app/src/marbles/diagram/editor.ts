import type { WindowEdge } from '../model/edit';

/** Edits the diagram asks for; omit it for a read-only diagram */
export interface DiagramEditor {
	moveEvent: (input: string, id: string, frame: number) => void;
	removeEvent: (input: string, id: string) => void;
	/** Adds the lane's next value at `frame`, or at the first free frame */
	addValue: (input: string, frame?: number) => void;
	moveWindow: (index: number, edge: WindowEdge, frame: number) => void;
}
