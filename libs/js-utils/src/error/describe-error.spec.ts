import { describeError } from './describe-error';

describe('Describe Error Function', () => {
  it('should return the message of an Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError(new TypeError('bad type'))).toBe('bad type');
  });

  it('should fall back to the name of an Error without a message', () => {
    expect(describeError(new Error())).toBe('Error');
    expect(describeError(new RangeError())).toBe('RangeError');
  });

  it('should return strings as they are', () => {
    expect(describeError('plain')).toBe('plain');
    expect(describeError('')).toBe('');
  });

  it.each([
    [undefined, 'undefined'],
    [null, 'null'],
    [0, '0'],
    [false, 'false'],
    [10n, '10'],
    [Symbol('sym'), 'Symbol(sym)'],
  ])('should stringify the primitive %p', (value, expected) => {
    expect(describeError(value)).toBe(expected);
  });

  it('should use the message of error-like objects', () => {
    expect(describeError({ message: 'from api', status: 500 })).toBe('from api');
  });

  it('should serialize other plain objects', () => {
    expect(describeError({ code: 'E_FAIL' })).toBe('{"code":"E_FAIL"}');
  });

  it('should stringify arrays and functions', () => {
    expect(describeError(['a', 'b'])).toBe('a,b');
    expect(describeError(Object.assign(() => 1, { toString: () => 'fn' }))).toBe('fn');
  });

  it('should append the cause', () => {
    const error = new Error('Request failed', { cause: new Error('ECONNRESET') });

    expect(describeError(error)).toBe('Request failed; caused by: ECONNRESET');
  });

  it('should append nested causes', () => {
    const error = new Error('a', { cause: new Error('b', { cause: 'c' }) });

    expect(describeError(error)).toBe('a; caused by: b; caused by: c');
  });

  it('should list the errors of an AggregateError', () => {
    const error = new AggregateError([new Error('a'), 'b', { message: 'c' }], 'All failed');

    expect(describeError(error)).toBe('All failed [a; b; c]');
  });

  it('should not list an empty AggregateError', () => {
    expect(describeError(new AggregateError([], 'Nothing'))).toBe('Nothing');
  });

  it('should cut cyclic causes', () => {
    const error = new Error('loop');

    (error as { cause?: unknown }).cause = error;

    expect(describeError(error)).toBe('loop; caused by: …');
  });

  it('should stop following causes after 5 levels', () => {
    const error = [6, 5, 4, 3, 2, 1, 0].reduce<Error | undefined>((cause, level) => new Error(`${level}`, { cause }), undefined);

    expect(describeError(error)).toBe('0; caused by: 1; caused by: 2; caused by: 3; caused by: 4; caused by: 5; caused by: …');
  });

  describe('never throws', () => {
    it('should survive a throwing message getter', () => {
      const error = Object.defineProperty(new Error(), 'message', {
        get() {
          throw new Error('getter');
        },
      });

      expect(describeError(error)).toBe('[object Error]');
    });

    it('should survive an object that can not be serialized or stringified', () => {
      const cyclic: Record<string, unknown> = Object.create(null);

      cyclic['self'] = cyclic;

      expect(describeError(cyclic)).toBe('[object Object]');
    });

    it('should survive a revoked proxy', () => {
      const { proxy, revoke } = Proxy.revocable({}, {});

      revoke();

      expect(typeof describeError(proxy)).toBe('string');
    });
  });
});
