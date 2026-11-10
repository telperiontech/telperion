import { PaintletClass } from './types';

/**
 * Loads `worklet` into the paint worklet scope under `name`.
 * The class is serialized and shipped as a Blob module.
 */
export async function loadPaintWorklet(paintWorklet: Worklet, name: string, worklet: PaintletClass): Promise<void> {
  const source = `registerPaint(${JSON.stringify(name)}, ${worklet.toString()});`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));

  try {
    await paintWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
