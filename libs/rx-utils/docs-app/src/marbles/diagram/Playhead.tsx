import { useDiagram } from './diagram-context';
import { BOTTOM_PAD, TOP_PAD } from '../model/geometry';

/** The current frame while playing or scrubbing; hidden once playback has reached the end */
export function Playhead({ height }: { height: number }) {
	const { scale, time } = useDiagram();

	if (time >= scale.end) return null;

	const x = scale.x(time);

	return (
		<g className="pointer-events-none" aria-hidden="true">
			<line x1={x} x2={x} y1={TOP_PAD - 6} y2={height - BOTTOM_PAD} strokeWidth={1.5} className="stroke-secondary-500" />
			<text x={x} y={TOP_PAD - 12} textAnchor="middle" className="fill-secondary-600 font-mono text-[10px] font-semibold">
				{Math.floor(time)}
			</text>
		</g>
	);
}
