import { useCallback, useMemo, useRef } from 'react';
import type { AnyMarbleScenario, RunResult } from '../engine';
import { DiagramContext } from './diagram-context';
import type { DiagramEditor } from './editor';
import { InputLane } from './InputLane';
import { OperatorBox } from './OperatorBox';
import { OutputLane } from './OutputLane';
import { Playhead } from './Playhead';
import type { Colorer } from '../model/colors';
import type { EditableState } from '../model/editable';
import { VIEW_WIDTH, type TimeScale } from '../model/geometry';
import { layoutRows } from '../model/rows';

interface MarbleDiagramProps {
	scenario: AnyMarbleScenario;
	state: EditableState;
	/** Last run of the scenario; output lanes stay empty until there is one */
	result: RunResult | undefined;
	scale: TimeScale;
	colorer: Colorer;
	/** Playhead frame */
	time: number;
	editor?: DiagramEditor;
}

/** An SVG marble diagram: input lanes, the operator, one lane per subscriber */
export function MarbleDiagram({ scenario, state, result, scale, colorer, time, editor }: MarbleDiagramProps) {
	const svg = useRef<SVGSVGElement>(null);
	const { rows, height } = useMemo(() => layoutRows(scenario, state, result), [scenario, state, result]);
	const toFrame = useCallback(
		(clientX: number) => {
			const matrix = svg.current?.getScreenCTM();

			return matrix ? scale.frameAt(new DOMPoint(clientX, 0).matrixTransform(matrix.inverse()).x) : 0;
		},
		[scale],
	);
	const context = useMemo(() => ({ scale, colorer, toFrame, time }), [scale, colorer, toFrame, time]);
	const operator = rows.find((row) => row.kind === 'operator')?.label;

	return (
		<DiagramContext.Provider value={context}>
			<svg ref={svg} viewBox={`0 0 ${VIEW_WIDTH} ${height}`} className="block w-full min-w-[560px] select-none" role="group" aria-label={`Marble diagram of ${operator}`}>
				{rows.map((row) => {
					switch (row.kind) {
						case 'input':
							return <InputLane key={`input-${row.name}`} row={row} editor={editor} />;
						case 'operator':
							return <OperatorBox key="operator" label={row.label} y={row.y} />;
						default:
							return <OutputLane key={`output-${row.index}`} row={row} editor={editor} />;
					}
				})}
				<Playhead height={height} />
			</svg>
		</DiagramContext.Provider>
	);
}
