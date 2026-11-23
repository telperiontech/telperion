import { MARBLE_RADIUS } from '../model/geometry';

/** Completion is a vertical bar, an error a cross, as in the RxJS docs */
export function TerminalGlyph({ kind, x, y }: { kind: 'complete' | 'error'; x: number; y: number }) {
	if (kind === 'complete') {
		return <line x1={x} x2={x} y1={y - MARBLE_RADIUS} y2={y + MARBLE_RADIUS} strokeWidth={2.5} strokeLinecap="round" className="stroke-neutral-900" />;
	}

	const arm = MARBLE_RADIUS * 0.7;

	return (
		<g strokeWidth={2.5} strokeLinecap="round" className="stroke-danger-540">
			<line x1={x - arm} x2={x + arm} y1={y - arm} y2={y + arm} />
			<line x1={x - arm} x2={x + arm} y1={y + arm} y2={y - arm} />
		</g>
	);
}
