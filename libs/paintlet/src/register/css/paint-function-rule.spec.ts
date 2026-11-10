import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaintFunctionRule } from './paint-function-rule';

describe('createPaintFunctionRule', () => {
  it('creates an argument-less function', () => {
    expect(createPaintFunctionRule('tp-ripple', [])).toBe(
      '@function --tp-ripple() returns <image> { result: paint(tp-ripple); }'
    );
  });

  it('forwards typed arguments to paint()', () => {
    const rule = createPaintFunctionRule('tp-x', [
      { name: 'color-1', syntax: 'none | <color>', default: 'none' },
      { name: 'size', syntax: '<number>', default: '4' },
    ]);

    expect(rule).toBe(
      '@function --tp-x(--color-1 type(none | <color>): none, --size type(<number>): 4) returns <image> ' +
        '{ result: paint(tp-x, var(--color-1, none), var(--size, 4)); }'
    );
  });

  it('rejects invalid argument names', () => {
    expect(() => createPaintFunctionRule('tp-x', [{ name: 'a)', syntax: '*', default: '0' }])).toThrow(TypeError);
  });

  it('keeps the parameters but drops paint() arguments when forwarding is off', () => {
    const rule = createPaintFunctionRule('tp-x', [{ name: 'size', syntax: '<number>', default: '4' }], { forwardArgs: false });

    expect(rule).toBe('@function --tp-x(--size type(<number>): 4) returns <image> { result: paint(tp-x); }');
  });
});
