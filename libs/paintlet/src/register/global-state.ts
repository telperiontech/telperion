/**
 * Registration state shared across every copy of this package on the page
 * (duplicate installs, HMR re-evaluation, Storybook re-imports).
 */
export interface PaintletGlobalState {
  /** Registration result per paint name. */
  readonly paintlets: Map<string, Promise<boolean>>;
  /** Shared constructed stylesheet, created lazily. */
  sheet?: CSSStyleSheet;
  /** Whether the "unsupported" warning has been logged. */
  unsupportedWarned: boolean;
}

const STATE_KEY = Symbol.for('@telperion/paintlet');

type GlobalWithState = typeof globalThis & { [STATE_KEY]?: PaintletGlobalState };

export function getGlobalState(): PaintletGlobalState {
  const scope = globalThis as GlobalWithState;

  return (scope[STATE_KEY] ??= {
    paintlets: new Map(),
    unsupportedWarned: false,
  });
}
