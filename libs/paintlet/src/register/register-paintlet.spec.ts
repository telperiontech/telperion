import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlobalState } from './global-state';
import { registerPaintlet, whenPaintletRegistered } from './register-paintlet';
import { getPaintletStyleSheet } from './style-sheet';
import { PaintletClass } from './types';

/**
 * Minimal constructable stylesheet; jsdom has neither constructable sheets
 * nor `adoptedStyleSheets`.
 */
class FakeCSSStyleSheet {
  readonly cssRules: string[] = [];

  insertRule(rule: string, index: number): number {
    if (rule.startsWith('@function')) throw new DOMException('unsupported', 'SyntaxError');
    this.cssRules.splice(index, 0, rule);
    return index;
  }
}

function resetPaintletGlobalState(): void {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('@telperion/paintlet')];
}

class TestPaintlet {
  static PROPERTIES = [{ name: '--tp-test-color', syntax: '<color>', inherits: true, initialValue: 'red' }];

  paint(): void {
    // noop
  }
}

describe('registerPaintlet', () => {
  const addModule = vi.fn<[string], Promise<void>>();
  const registerProperty = vi.fn();

  beforeEach(() => {
    resetPaintletGlobalState();
    addModule.mockReset().mockResolvedValue(undefined);
    registerProperty.mockReset();
    vi.stubGlobal('CSS', { paintWorklet: { addModule }, registerProperty });
    vi.stubGlobal('CSSStyleSheet', FakeCSSStyleSheet);
    Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true, configurable: true });
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the worklet, registers properties and adopts the shared sheet', async () => {
    await expect(registerPaintlet({ name: 'tp-test', worklet: TestPaintlet })).resolves.toBe(true);

    expect(addModule).toHaveBeenCalledWith('blob:test');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(registerProperty).toHaveBeenCalledWith(expect.objectContaining({ name: '--tp-test-color' }));
    expect(document.adoptedStyleSheets).toEqual([getPaintletStyleSheet()]);
  });

  it('serializes the class under the given name', async () => {
    let source = '';
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: BlobPart[]) {
          source = String(parts[0]);
        }
      }
    );

    await registerPaintlet({ name: 'tp-test', worklet: TestPaintlet });

    expect(source.startsWith('registerPaint("tp-test", class TestPaintlet')).toBe(true);
  });

  it('inserts each rule separately so unsupported rules do not drop the rest', async () => {
    await registerPaintlet({ name: 'tp-test', worklet: TestPaintlet, animations: { 'tp-test-anim': '--tp-test-frame' } });

    // The fake rejects @function rules; the @keyframes rule must survive.
    expect((getPaintletStyleSheet() as unknown as FakeCSSStyleSheet).cssRules).toEqual([
      '@keyframes tp-test-anim { from { --tp-test-frame: 0; } to { --tp-test-frame: 100; } }',
    ]);
  });

  it.each([
    [true, 'paint(tp-test, var(--size, 4))'],
    [false, 'paint(tp-test)'],
  ])('forwards function arguments to paint() only when supported (%s)', async (supported, expected) => {
    const insertRule = vi.spyOn(FakeCSSStyleSheet.prototype, 'insertRule').mockReturnValue(0);
    vi.stubGlobal('CSS', { paintWorklet: { addModule }, registerProperty, supports: () => supported });

    await registerPaintlet({ name: 'tp-test', worklet: TestPaintlet, args: [{ name: 'size', syntax: '<number>', default: '4' }] });

    expect(insertRule).toHaveBeenCalledWith(expect.stringContaining(`result: ${expected};`), 0);
  });

  it('is idempotent per name', async () => {
    const first = registerPaintlet({ name: 'tp-test', worklet: TestPaintlet });
    const second = registerPaintlet({ name: 'tp-test', worklet: TestPaintlet });

    expect(second).toBe(first);
    expect(whenPaintletRegistered('tp-test')).toBe(first);
    await first;
    expect(addModule).toHaveBeenCalledOnce();
    expect(registerProperty).toHaveBeenCalledOnce();
  });

  it('logs and rejects when the worklet fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    addModule.mockRejectedValue(new Error('boom'));

    await expect(registerPaintlet({ name: 'tp-test', worklet: TestPaintlet })).rejects.toThrow('boom');
    expect(error).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('warns once and resolves false without the Paint API', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('CSS', { registerProperty });

    await expect(registerPaintlet({ name: 'tp-a', worklet: TestPaintlet })).resolves.toBe(false);
    await expect(registerPaintlet({ name: 'tp-b', worklet: TestPaintlet })).resolves.toBe(false);

    expect(warn).toHaveBeenCalledOnce();
    expect(registerProperty).not.toHaveBeenCalled();
    expect(getGlobalState().paintlets.size).toBe(0);
  });

  it('resolves false outside the browser without warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('window', undefined);

    await expect(registerPaintlet({ name: 'tp-test', worklet: TestPaintlet })).resolves.toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(addModule).not.toHaveBeenCalled();
  });

  it('rejects invalid names', () => {
    expect(() => registerPaintlet({ name: "x'); alert(1); ('", worklet: TestPaintlet as PaintletClass })).toThrow(TypeError);
  });
});
