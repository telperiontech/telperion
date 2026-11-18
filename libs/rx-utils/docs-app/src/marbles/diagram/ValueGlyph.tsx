import { useDiagram } from './diagram-context';
import { NEUTRAL } from '../model/colors';
import { formatValue } from '../model/format';
import { DOT_GAP, DOT_RADIUS, MARBLE_RADIUS } from '../model/geometry';
import type { PlacedEvent } from '../model/placement';

type ValueGlyphProps = Pick<PlacedEvent<never>, 'shape' | 'label' | 'fullLabel' | 'x' | 'width'> & { value: unknown; y: number };

const textClass = 'pointer-events-none fill-neutral-990 font-mono';

/** A marble: a circle for short labels, a pill for long ones, a pill of small marbles for arrays */
export function ValueGlyph({ value, shape, label, fullLabel, x, y, width }: ValueGlyphProps) {
	const { colorer } = useDiagram();

	if (shape === 'array' && Array.isArray(value)) {
		const first = x - width / 2 + 6 + DOT_RADIUS;

		return (
			<g>
				<title>{fullLabel}</title>
				<rect x={x - width / 2} y={y - MARBLE_RADIUS} width={width} height={MARBLE_RADIUS * 2} rx={MARBLE_RADIUS} strokeWidth={1.5} className={`${NEUTRAL.fill} ${NEUTRAL.stroke}`} />
				{value.length === 0 && (
					<text x={x} y={y} textAnchor="middle" dominantBaseline="central" className={`${textClass} text-[11px]`}>[ ]</text>
				)}
				{value.map((item, index) => {
					const color = colorer(item);
					const cx = first + index * (DOT_RADIUS * 2 + DOT_GAP);

					return (
						<g key={index}>
							<circle cx={cx} cy={y} r={DOT_RADIUS} strokeWidth={1.25} className={`${color.fill} ${color.stroke}`} />
							<text x={cx} y={y} textAnchor="middle" dominantBaseline="central" className={`${textClass} text-[10px]`}>{formatValue(item)}</text>
						</g>
					);
				})}
			</g>
		);
	}

	const color = colorer(value);

	return (
		<g>
			{label !== fullLabel && <title>{fullLabel}</title>}
			{shape === 'circle' ? (
				<circle cx={x} cy={y} r={MARBLE_RADIUS} strokeWidth={1.5} className={`${color.fill} ${color.stroke}`} />
			) : (
				<rect x={x - width / 2} y={y - MARBLE_RADIUS} width={width} height={MARBLE_RADIUS * 2} rx={MARBLE_RADIUS} strokeWidth={1.5} className={`${color.fill} ${color.stroke}`} />
			)}
			<text x={x} y={y} textAnchor="middle" dominantBaseline="central" className={`${textClass} text-[11px]`}>{label}</text>
		</g>
	);
}
