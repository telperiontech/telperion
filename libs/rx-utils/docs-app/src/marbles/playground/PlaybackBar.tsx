import { PanelAction } from '@osw/docs';
import { Icon } from '@osw/react';
import type { Playback } from './use-playback';

interface PlaybackBarProps {
	playback: Playback;
	end: number;
	/** The reader changed the inputs, subscribers or args */
	dirty: boolean;
	onReset: () => void;
}

/** Play/pause, a scrubber and a reset for the reader's edits */
export function PlaybackBar({ playback, end, dirty, onReset }: PlaybackBarProps) {
	const { time, playing, play, pause, seek } = playback;

	return (
		<div className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2">
			<button
				type="button"
				onClick={playing ? pause : play}
				aria-label={playing ? 'Pause' : 'Play'}
				className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-600 text-white transition-colors hover:bg-secondary-700"
			>
				<Icon name={playing ? 'pause' : 'play_arrow'} size={20} />
			</button>
			<input
				type="range"
				min={0}
				max={end}
				step={0.1}
				value={time}
				onChange={(event) => seek(event.target.valueAsNumber)}
				aria-label="Playhead frame"
				aria-valuetext={`Frame ${Math.floor(time)} of ${end}`}
				className="min-w-0 flex-1 accent-secondary-600"
			/>
			<span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-850" aria-hidden="true">
				{Math.floor(time)}/{end}
			</span>
			<PanelAction icon="restart_alt" onClick={onReset} disabled={!dirty}>
				Reset
			</PanelAction>
		</div>
	);
}
