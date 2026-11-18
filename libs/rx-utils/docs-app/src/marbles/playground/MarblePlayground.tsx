import { useEffect, useId, useMemo, useState } from 'react';
import { CodeBlock } from '@osw/docs';
import { stateEnd, type AnyMarbleScenario } from '../engine';
import { MarbleDiagram } from '../diagram/MarbleDiagram';
import { createColorer } from '../model/colors';
import { editableState, valuePool } from '../model/editable';
import { timeScale } from '../model/geometry';
import { ArgControls } from './ArgControls';
import { PlaybackBar } from './PlaybackBar';
import { useDiagramEditor } from './use-diagram-editor';
import { usePlayback } from './use-playback';
import { useScenarioRun } from './use-scenario-run';

/** Frames after the last thing that happens, so terminal marks and arrows have room */
const TAIL = 3;
/** Longest timeline a reader can drag out */
const MAX_FRAMES = 60;

/** Every value the scenario's inputs can hold, in order, so colors stay put while editing */
function colorerOf(scenario: AnyMarbleScenario, initial: ReturnType<typeof editableState>) {
	const authored = Object.values(initial.inputs).flatMap((events) => events.flatMap((event) => (event.kind === 'next' ? [event.value] : [])));
	const pools = Object.values(scenario.inputs).flatMap((spec) => valuePool(spec));

	return createColorer([...authored, ...pools]);
}

/** An editable, animated marble diagram that runs the real code on every change */
export function MarblePlayground({ scenario }: { scenario: AnyMarbleScenario }) {
	const idPrefix = useId();
	const initial = useMemo(() => editableState(scenario), [scenario]);
	const colorer = useMemo(() => colorerOf(scenario, initial), [scenario, initial]);
	const [state, setState] = useState(initial);
	const result = useScenarioRun(scenario, state);
	// The axis grows with the content but never shrinks under a dragging pointer; Reset shrinks it
	const needed = Math.min(MAX_FRAMES, Math.max(stateEnd(state), result?.end ?? 0, scenario.duration ?? 0) + TAIL);
	const [domain, setDomain] = useState(needed);

	useEffect(() => setDomain((current) => Math.max(current, needed)), [needed]);

	const end = Math.max(domain, needed);
	const scale = useMemo(() => timeScale(end), [end]);
	const playback = usePlayback(end);
	const editor = useDiagramEditor(scenario, setState, end);
	const reset = () => {
		setState(initial);
		setDomain(0);
		playback.seek(Infinity);
	};

	return (
		<div className="mt-4">
			<div className="overflow-hidden rounded-xl border border-neutral-100">
				<PlaybackBar playback={playback} end={end} dirty={state !== initial} onReset={reset} />
				<div className="overflow-x-auto px-3 py-2">
					<MarbleDiagram scenario={scenario} state={state} result={result} scale={scale} colorer={colorer} time={playback.time} editor={editor} />
				</div>
				{result?.error && (
					<p role="alert" className="border-t border-neutral-100 bg-danger-50 px-4 py-2 font-mono text-xs text-danger-800">
						{result.error}
					</p>
				)}
				{scenario.args && (
					<ArgControls specs={scenario.args} values={state.args} idPrefix={idPrefix} onChange={(name, value) => setState((current) => ({ ...current, args: { ...current.args, [name]: value } }))} />
				)}
				<p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-850">
					Drag marbles along their lane, double-click a lane to add one, double-click a marble (or focus it and press Delete) to remove it.
					Bars under an input show when it is subscribed.
				</p>
			</div>
			{scenario.code && <CodeBlock code={scenario.code(state.args)} className="mt-4" />}
		</div>
	);
}
