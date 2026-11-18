import { useDiagram } from './diagram-context';
import { OPERATOR_HEIGHT } from '../model/geometry';

/** The code under test, between the inputs and the subscribers */
export function OperatorBox({ label, y }: { label: string; y: number }) {
	const { scale } = useDiagram();
	const height = OPERATOR_HEIGHT - 10;

	return (
		<g>
			<rect x={scale.axisStart} y={y - height / 2} width={scale.axisEnd - scale.axisStart} height={height} rx={8} strokeWidth={1} className="fill-neutral-20 stroke-neutral-150" />
			<text x={(scale.axisStart + scale.axisEnd) / 2} y={y} textAnchor="middle" dominantBaseline="central" className="fill-neutral-990 font-mono text-[12px] font-semibold">
				{label}
			</text>
		</g>
	);
}
