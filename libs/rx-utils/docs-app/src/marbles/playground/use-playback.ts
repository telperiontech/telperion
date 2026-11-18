import { useCallback, useEffect, useRef, useState } from 'react';

export interface Playback {
	/** Playhead frame; equals `end` when idle, so the whole diagram shows */
	time: number;
	playing: boolean;
	play: () => void;
	pause: () => void;
	seek: (frame: number) => void;
}

/** Slowest playback, in frames per second; long timelines play faster to stay around four seconds */
const MIN_RATE = 6;
const TARGET_SECONDS = 4;

/** A playhead sweeping from frame 0 to `end` on `requestAnimationFrame` */
export function usePlayback(end: number): Playback {
	/** `null` = parked at the end, whatever `end` becomes */
	const [position, setPosition] = useState<number | null>(null);
	const [playing, setPlaying] = useState(false);
	const positionRef = useRef(position);
	const endRef = useRef(end);

	positionRef.current = position;
	endRef.current = end;

	useEffect(() => {
		if (!playing) return;

		const from = positionRef.current ?? 0;
		const startedAt = performance.now();
		const rate = Math.max(MIN_RATE, endRef.current / TARGET_SECONDS);
		let handle = 0;
		const tick = (now: number) => {
			const next = from + ((now - startedAt) / 1000) * rate;

			if (next >= endRef.current) {
				setPosition(null);
				setPlaying(false);

				return;
			}

			setPosition(next);
			handle = requestAnimationFrame(tick);
		};

		handle = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(handle);
	}, [playing]);

	const play = useCallback(() => {
		if (positionRef.current === null) setPosition(0);

		setPlaying(true);
	}, []);
	const pause = useCallback(() => setPlaying(false), []);
	const seek = useCallback((frame: number) => {
		setPlaying(false);
		setPosition(frame >= endRef.current ? null : Math.max(0, frame));
	}, []);

	return { time: position ?? end, playing, play, pause, seek };
}
