import type { SubscriptionWindow } from '../engine';
import { useDiagram } from './diagram-context';
import { MARBLE_RADIUS } from '../model/geometry';

const BAND_HEIGHT = 3;
const BAND_GAP = 2;
const describe = (window: SubscriptionWindow) =>
	window.unsubscribe === undefined
		? `Subscribed from frame ${window.subscribe}, never unsubscribed`
		: `Subscribed from frame ${window.subscribe} to ${window.unsubscribe}`;

/** One bar under an input lane per subscription it received, spanning the frames it was subscribed */
export function SubscriptionBands({ windows, y }: { windows: readonly SubscriptionWindow[]; y: number }) {
	const { scale } = useDiagram();

	return (
		<g>
			{windows.map((window, index) => {
				const from = scale.x(window.subscribe);
				const to = window.unsubscribe === undefined ? scale.axisEnd : scale.x(window.unsubscribe);

				return (
					<rect
						key={index}
						x={from}
						y={y + MARBLE_RADIUS + 6 + index * (BAND_HEIGHT + BAND_GAP)}
						width={Math.max(to - from, 2)}
						height={BAND_HEIGHT}
						rx={BAND_HEIGHT / 2}
						className="fill-secondary-300"
					>
						<title>{describe(window)}</title>
					</rect>
				);
			})}
		</g>
	);
}
