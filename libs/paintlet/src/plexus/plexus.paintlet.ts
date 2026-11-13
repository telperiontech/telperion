import { PaintRenderingContext2D, PaintSize } from '../paint.type';
import { registerPaintlet } from '../register';

/**
 * Configuration for the Plexus Paintlet
 */
interface PlexusConfig {
  dotColor: string;
  lineColor: string;
  density: number;
  dotSize: number;
  lineWidth: number;
  proximity: number;
  maxLaps: number;
  seed: number;
  frame: number;
}

/**
 * Plexus Paintlet
 * Drifting dots that bounce off the element edges, joined by lines whenever
 * two of them come within `proximity` pixels of each other (a "particle
 * network" / constellation background).
 *
 * Paint worklets are stateless, so every frame is computed from
 * `--tp-plexus-frame` alone. Each dot travels a whole number of edge-to-edge
 * round trips per animation cycle on each axis, which makes frame `100`
 * identical to frame `0` and the loop seamless. The animation duration
 * therefore sets the speed: longer durations mean slower dots.
 *
 * Custom Properties:
 * - `--tp-plexus-dot-color`: Dot color (default: `#666666`)
 * - `--tp-plexus-line-color`: Line color (default: `#666666`)
 * - `--tp-plexus-density`: Area in px² per dot, lower means more dots (default: `10000`)
 * - `--tp-plexus-dot-size`: Dot diameter in px (default: `3.5`)
 * - `--tp-plexus-line-width`: Line width in px (default: `1`)
 * - `--tp-plexus-proximity`: Max distance in px for two dots to be joined (default: `100`)
 * - `--tp-plexus-max-laps`: Max round trips per axis per animation cycle (default: `2`)
 * - `--tp-plexus-seed`: Seed for deterministic randomness (default: `1`)
 * - `--tp-plexus-frame`: Animation frame from 0 to 100 (default: `0`)
 *
 * @example
 * ```css
 * .hero {
 *   background-image: --tp-plexus();
 *   animation: --tp-plexus-animation(60s);
 *   --tp-plexus-dot-color: #eeeeee;
 *   --tp-plexus-line-color: #eeeeee;
 * }
 * ```
 */
export class PlexusPaintlet {
  static PROPERTIES = [
    {
      name: '--tp-plexus-dot-color',
      syntax: '<color>',
      inherits: true,
      initialValue: '#666666',
    },
    {
      name: '--tp-plexus-line-color',
      syntax: '<color>',
      inherits: true,
      initialValue: '#666666',
    },
    {
      name: '--tp-plexus-density',
      syntax: '<number>',
      inherits: true,
      initialValue: 10000,
    },
    {
      name: '--tp-plexus-dot-size',
      syntax: '<number>',
      inherits: true,
      initialValue: 3.5,
    },
    {
      name: '--tp-plexus-line-width',
      syntax: '<number>',
      inherits: true,
      initialValue: 1,
    },
    {
      name: '--tp-plexus-proximity',
      syntax: '<number>',
      inherits: true,
      initialValue: 100,
    },
    {
      name: '--tp-plexus-max-laps',
      syntax: '<number>',
      inherits: true,
      initialValue: 2,
    },
    {
      name: '--tp-plexus-seed',
      syntax: '<number>',
      inherits: true,
      initialValue: 1,
    },
    {
      name: '--tp-plexus-frame',
      syntax: '<number>',
      inherits: true,
      initialValue: 0,
    },
  ];

  static get inputProperties(): string[] {
    return this.PROPERTIES.map((prop) => prop.name);
  }

  /** Upper bound on dots; line checks grow with the square of this. */
  #MAX_DOTS = 400;

  #PLEXUS_DEFAULTS: PlexusConfig = {
    dotColor: '#666666',
    lineColor: '#666666',
    density: 10000,
    dotSize: 3.5,
    lineWidth: 1,
    proximity: 100,
    maxLaps: 2,
    seed: 1,
    frame: 0,
  };

  /**
   * Extract configuration from CSS custom properties
   */
  #getConfig(properties: StylePropertyMapReadOnly): PlexusConfig {
    const d = this.#PLEXUS_DEFAULTS;
    const num = (name: string, fallback: number) => {
      const value = parseFloat(properties.get(name)?.toString() ?? '');

      return Number.isFinite(value) ? value : fallback;
    };

    return {
      dotColor: properties.get('--tp-plexus-dot-color')?.toString().trim() || d.dotColor,
      lineColor: properties.get('--tp-plexus-line-color')?.toString().trim() || d.lineColor,
      density: num('--tp-plexus-density', d.density),
      dotSize: num('--tp-plexus-dot-size', d.dotSize),
      lineWidth: num('--tp-plexus-line-width', d.lineWidth),
      proximity: num('--tp-plexus-proximity', d.proximity),
      maxLaps: num('--tp-plexus-max-laps', d.maxLaps),
      seed: num('--tp-plexus-seed', d.seed),
      frame: num('--tp-plexus-frame', d.frame),
    };
  }

  paint(
    ctx: PaintRenderingContext2D,
    { width, height }: PaintSize,
    properties: StylePropertyMapReadOnly
  ): void {
    if (width <= 0 || height <= 0) return;

    const config = this.#getConfig(properties);
    const xs: number[] = [];
    const ys: number[] = [];
    this.#placeDots(config, width, height, xs, ys);

    this.#drawLines(ctx, config, xs, ys);
    this.#drawDots(ctx, config, xs, ys);
  }

  /**
   * Compute every dot's position at the current frame.
   */
  #placeDots(config: PlexusConfig, width: number, height: number, xs: number[], ys: number[]): void {
    const count = Math.min(this.#MAX_DOTS, Math.round((width * height) / Math.max(1, config.density)));
    const laps = Math.max(1, Math.round(config.maxLaps));
    const t = (((config.frame / 100) % 1) + 1) % 1;
    const radius = Math.max(0, config.dotSize) / 2;
    const spanX = Math.max(0, width - radius * 2);
    const spanY = Math.max(0, height - radius * 2);

    for (let i = 0; i < count; i++) {
      // A dot needs to move on at least one axis.
      let kx = 0;
      let ky = 0;

      for (let attempt = 0; kx === 0 && ky === 0; attempt++) {
        kx = this.#lapCount(this.#hash(i, attempt, config.seed + 11.3), laps);
        ky = this.#lapCount(this.#hash(i, attempt, config.seed + 29.7), laps);
      }

      const startX = this.#hash(i, 0, config.seed) * spanX;
      const startY = this.#hash(i, 0, config.seed + 5.1) * spanY;

      xs.push(radius + this.#bounce(startX + kx * 2 * spanX * t, spanX));
      ys.push(radius + this.#bounce(startY + ky * 2 * spanY * t, spanY));
    }
  }

  /**
   * Join every pair of dots closer than `proximity`, fading with distance.
   */
  #drawLines(ctx: PaintRenderingContext2D, config: PlexusConfig, xs: number[], ys: number[]): void {
    if (config.lineWidth <= 0 || config.proximity <= 0) return;

    const maxDistSq = config.proximity * config.proximity;
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineWidth;

    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        const dx = xs[i] - xs[j];
        const dy = ys[i] - ys[j];
        const distSq = dx * dx + dy * dy;

        if (distSq >= maxDistSq) continue;

        ctx.globalAlpha = 1 - Math.sqrt(distSq) / config.proximity;
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[j], ys[j]);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  #drawDots(ctx: PaintRenderingContext2D, config: PlexusConfig, xs: number[], ys: number[]): void {
    const radius = config.dotSize / 2;

    if (radius <= 0) return;

    ctx.fillStyle = config.dotColor;
    ctx.beginPath();

    for (let i = 0; i < xs.length; i++) {
      ctx.moveTo(xs[i] + radius, ys[i]);
      ctx.arc(xs[i], ys[i], radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /**
   * Map a hash in [0, 1) to an integer lap count in [-laps, laps].
   */
  #lapCount(value: number, laps: number): number {
    return Math.floor(value * (laps * 2 + 1)) - laps;
  }

  /**
   * Fold an unbounded coordinate into [0, span], as if the dot bounced off
   * both ends. Moving it by any multiple of `2 * span` gives back the same
   * result, which is what makes the animation loop.
   */
  #bounce(value: number, span: number): number {
    if (span <= 0) return 0;

    const period = span * 2;
    const p = ((value % period) + period) % period;

    return p <= span ? p : period - p;
  }

  /**
   * Deterministic 2D hash returning a value in [0, 1).
   */
  #hash(x: number, y: number, seed: number): number {
    const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;

    return v - Math.floor(v);
  }
}

// Auto-register the paintlet when module loads
registerPaintlet({
  name: 'tp-plexus',
  worklet: PlexusPaintlet,
  animations: { 'tp-plexus-animation': '--tp-plexus-frame' },
});
