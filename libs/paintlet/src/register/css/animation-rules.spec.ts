import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimationRules } from './animation-rules';

describe('createAnimationRules', () => {
  it('returns no rules for no animations', () => {
    expect(createAnimationRules({})).toEqual([]);
  });

  it('creates a keyframes rule and a helper function per animation', () => {
    expect(createAnimationRules({ 'tp-rain-animation': '--tp-rain-frame' })).toEqual([
      '@keyframes tp-rain-animation { from { --tp-rain-frame: 0; } to { --tp-rain-frame: 100; } }',
      '@function --tp-rain-animation(--seconds <time>) { result: tp-rain-animation var(--seconds, 1s) linear infinite; }',
    ]);
  });

  it('rejects invalid animation names', () => {
    expect(() => createAnimationRules({ 'bad name; }': '--x' })).toThrow(TypeError);
  });

  it('rejects animated properties that are not custom properties', () => {
    expect(() => createAnimationRules({ anim: 'color' })).toThrow(TypeError);
  });
});
