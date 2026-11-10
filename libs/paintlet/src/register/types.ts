import { CSSPropertyDefinition, PaintRenderingContext2D, PaintSize } from '../paint.type';

/**
 * Instance shape expected by `registerPaint()` inside the paint worklet.
 */
export interface PaintletInstance {
  paint(
    ctx: PaintRenderingContext2D,
    geom: PaintSize,
    properties: StylePropertyMapReadOnly,
    args?: readonly CSSStyleValue[]
  ): void;
}

/**
 * A paint worklet class.
 *
 * The class is serialized with `Function.prototype.toString()` and evaluated
 * inside the worklet scope, so it MUST be fully self-contained: no imports,
 * no references to module-level helpers or variables.
 */
export interface PaintletClass {
  new (): PaintletInstance;
  readonly PROPERTIES?: readonly CSSPropertyDefinition[];
  readonly inputProperties?: readonly string[];
  readonly inputArguments?: readonly string[];
  readonly contextOptions?: { alpha?: boolean };
}

/**
 * A typed argument of the generated `--<name>()` CSS function.
 */
export interface PaintletArgDefinition {
  /** Argument name without the leading `--`. */
  name: string;
  /** CSS syntax string, e.g. `<color>` or `none | <color>`. */
  syntax: string;
  /** Default value used when the argument is omitted. */
  default: string;
}

export interface RegisterPaintletOptions {
  /** Paint name used in `paint(<name>)` and the `--<name>()` CSS function. */
  name: string;
  /** Self-contained worklet class. */
  worklet: PaintletClass;
  /** Custom properties to register. Defaults to `worklet.PROPERTIES`. */
  properties?: readonly CSSPropertyDefinition[];
  /** Arguments of the generated `--<name>()` CSS function. */
  args?: readonly PaintletArgDefinition[];
  /**
   * Looping animations to generate, as `{ animationName: customPropertyName }`.
   * Each produces `@keyframes <animationName>` (0 → 100) and a
   * `--<animationName>(--seconds)` CSS function.
   */
  animations?: Readonly<Record<string, string>>;
}
