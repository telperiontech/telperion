import { PaintletArgDefinition } from '../types';
import { assertIdent } from '../validate-ident';

/**
 * Builds the `@function --<name>(...) returns <image>` rule that wraps `paint(<name>, ...)`.
 *
 * With `forwardArgs: false` the function keeps its parameters (so calls stay
 * valid CSS) but emits a bare `paint(<name>)`. Use this where the browser does
 * not support `paint()` arguments; the worklet then reads its custom properties.
 */
export function createPaintFunctionRule(
  name: string,
  args: readonly PaintletArgDefinition[],
  { forwardArgs = true }: { forwardArgs?: boolean } = {}
): string {
  args.forEach(arg => assertIdent(arg.name, 'argument name'));

  const params = args.map(arg => `--${arg.name} type(${arg.syntax}): ${arg.default}`).join(', ');
  const paintArgs = forwardArgs ? args.map(arg => `, var(--${arg.name}, ${arg.default})`).join('') : '';

  return `@function --${name}(${params}) returns <image> { result: paint(${name}${paintArgs}); }`;
}
