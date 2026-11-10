import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerProperties } from './property-registration';

describe('registerProperties', () => {
  const registerProperty = vi.fn();

  beforeEach(() => {
    registerProperty.mockReset();
    vi.stubGlobal('CSS', { registerProperty });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers each property with a string initial value', () => {
    registerProperties([{ name: '--a', syntax: '<number>', inherits: true, initialValue: 5 }]);

    expect(registerProperty).toHaveBeenCalledWith({ name: '--a', syntax: '<number>', inherits: true, initialValue: '5' });
  });

  it('silently skips already registered properties', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    registerProperty.mockImplementationOnce(() => {
      throw new DOMException('exists', 'InvalidModificationError');
    });

    registerProperties([
      { name: '--a', syntax: '<number>', inherits: true, initialValue: 0 },
      { name: '--b', syntax: '<number>', inherits: true, initialValue: 0 },
    ]);

    expect(registerProperty).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about invalid definitions and continues', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    registerProperty.mockImplementationOnce(() => {
      throw new DOMException('bad syntax', 'SyntaxError');
    });

    registerProperties([
      { name: '--a', syntax: '<nope>', inherits: true, initialValue: 0 },
      { name: '--b', syntax: '<number>', inherits: true, initialValue: 0 },
    ]);

    expect(registerProperty).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('does nothing without CSS.registerProperty', () => {
    vi.stubGlobal('CSS', {});

    expect(() => registerProperties([{ name: '--a', syntax: '*', inherits: true, initialValue: '' }])).not.toThrow();
  });
});
