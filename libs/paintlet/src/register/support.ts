import { getGlobalState } from './global-state';

/**
 * `CSS.paintWorklet` is not part of TypeScript's DOM lib.
 */
interface PaintWorkletHost {
  paintWorklet?: Worklet;
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getPaintWorklet(): Worklet | undefined {
  if (typeof CSS === 'undefined') return undefined;

  return (CSS as unknown as PaintWorkletHost).paintWorklet;
}

/**
 * Logs the "unsupported" warning only once per page.
 */
export function warnPaintApiUnsupportedOnce(): void {
  const state = getGlobalState();

  if (state.unsupportedWarned) return;

  state.unsupportedWarned = true;
  console.warn('[@telperion/paintlet] CSS Paint API is not supported in this browser; paintlets are not registered.');
}

/**
 * Whether `paint()` accepts arguments (`paint(name, red)`).
 * In Chrome this is still behind "Experimental Web Platform features".
 */
export function supportsPaintArguments(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('background-image', 'paint(tp-probe, red)');
}
