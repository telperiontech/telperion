import { createAnimationRules } from './css/animation-rules';
import { createPaintFunctionRule } from './css/paint-function-rule';
import { registerProperties } from './css/property-registration';
import { getGlobalState } from './global-state';
import { insertRules } from './style-sheet';
import { getPaintWorklet, isBrowser, supportsPaintArguments, warnPaintApiUnsupportedOnce } from './support';
import { RegisterPaintletOptions } from './types';
import { assertIdent } from './validate-ident';
import { loadPaintWorklet } from './worklet-loader';

/**
 * Registers a paintlet: its custom properties, its CSS helper functions and
 * animations, and the paint worklet itself.
 *
 * Idempotent per `name`: repeated calls return the first registration.
 *
 * When the browser does not support `paint()` arguments, the generated
 * `--<name>()` function ignores its arguments and the worklet falls back to
 * its custom properties.
 *
 * Resolves `true` once the worklet is loaded, `false` when the environment has
 * no CSS Paint API (SSR or unsupported browser). Rejects if the worklet fails
 * to load; the failure is also logged, so callers may ignore the promise.
 */
export function registerPaintlet(options: RegisterPaintletOptions): Promise<boolean> {
  const { name, worklet, properties = worklet.PROPERTIES ?? [], args = [], animations = {} } = options;

  assertIdent(name, 'paintlet name');

  if (!isBrowser()) return Promise.resolve(false);

  const paintWorklet = getPaintWorklet();

  if (!paintWorklet) {
    warnPaintApiUnsupportedOnce();
    return Promise.resolve(false);
  }

  const { paintlets } = getGlobalState();
  const existing = paintlets.get(name);

  if (existing) return existing;

  registerProperties(properties);
  insertRules([
    ...createAnimationRules(animations),
    createPaintFunctionRule(name, args, { forwardArgs: args.length === 0 || supportsPaintArguments() }),
  ]);

  const ready = loadPaintWorklet(paintWorklet, name, worklet).then(() => true);

  paintlets.set(name, ready);
  ready.catch(error => console.error(`[@telperion/paintlet] Failed to load paintlet "${name}".`, error));

  return ready;
}

/**
 * Returns the registration promise of a paintlet, or `undefined` if no
 * paintlet with that name has been registered.
 */
export function whenPaintletRegistered(name: string): Promise<boolean> | undefined {
  return getGlobalState().paintlets.get(name);
}

