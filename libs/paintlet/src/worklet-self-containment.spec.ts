import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckPaintlet } from './check';
import { LowPolyMeshPaintlet } from './low-poly-mesh';
import { PalGradientPaintlet } from './pal-gradient';
import { RainPaintlet } from './rain';
import { RipplePaintlet } from './ripple';
import { PaintletClass } from './register';

/**
 * Paintlet classes are shipped to the worklet via `toString()`, so they must not
 * depend on anything outside the class body. Evaluate each serialized class in
 * an empty scope, like the worklet does.
 */
describe.each([
  ['tp-check', CheckPaintlet],
  ['tp-low-poly-mesh', LowPolyMeshPaintlet],
  ['tp-pal-gradient', PalGradientPaintlet],
  ['tp-rain', RainPaintlet],
  ['tp-ripple', RipplePaintlet],
] as [string, PaintletClass][])('%s worklet source', (name, worklet) => {
  it('is self-contained', () => {
    let registered: PaintletClass | undefined;
    const registerPaint = (_: string, cls: PaintletClass) => (registered = cls);

    new Function('registerPaint', `registerPaint(${JSON.stringify(name)}, ${worklet.toString()});`)(registerPaint);

    expect(registered).toBeDefined();
    expect(registered?.inputProperties).toEqual(worklet.inputProperties);
    expect(() => new (registered as PaintletClass)()).not.toThrow();
  });
});

describe('paintlet property definitions', () => {
  // Every name in a keyword-list syntax must be a CSS identifier;
  // `<…>` components must be one of the supported data types.
  const SUPPORTED_TYPES = new Set([
    'angle', 'color', 'custom-ident', 'image', 'integer', 'length', 'length-percentage',
    'number', 'percentage', 'resolution', 'string', 'time', 'transform-function', 'transform-list', 'url',
  ]);

  it.each([CheckPaintlet, LowPolyMeshPaintlet, PalGradientPaintlet, RainPaintlet, RipplePaintlet].flatMap(
    worklet => (worklet as PaintletClass).PROPERTIES ?? []
  ).map(property => [property.name, property.syntax]))('%s has a valid syntax', (_, syntax) => {
    for (const component of syntax.split('|').map(part => part.trim().replace(/[+#]$/, ''))) {
      const type = /^<(.+)>$/.exec(component)?.[1];

      if (type) expect(SUPPORTED_TYPES).toContain(type);
      else expect(component).toMatch(/^[a-zA-Z_][a-zA-Z0-9_-]*$/);
    }
  });
});
