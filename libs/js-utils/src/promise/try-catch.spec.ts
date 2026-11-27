import { NullishRejectionError, tryCatch } from './try-catch';

describe('AsyncTryCatch Function', () => {
  it('should resolve if promise resolved', done => {
    const foo = Promise.resolve('foo');

    tryCatch(foo).then(([err, res]) => {
      expect(err).toBe(null);
      expect(res).toBe('foo');
      done();
    });
  });

  it('should reject if promise rejected', done => {
    const foo = Promise.reject('error');

    tryCatch(foo).then(([err, res]) => {
      expect(err).toBe('error');
      expect(res).toBe(null);
      done();
    });
  });

  it('should put the default result into the result slot when rejected', async () => {
    const [error, result] = await tryCatch(Promise.reject<string>('error'), 'default');

    expect(error).toBe('error');
    expect(result).toBe('default');
  });

  it('should keep falsy but non-nullish rejection reasons as they are', async () => {
    for (const reason of [0, '', false, Number.NaN]) {
      const [error, result] = await tryCatch(Promise.reject(reason));

      expect(error).toBe(reason);
      expect(result).toBe(null);
    }
  });

  describe('nullish rejections', () => {
    it.each([null, undefined])('should wrap a rejection with %s in a NullishRejectionError', async reason => {
      const [error, result] = await tryCatch(Promise.reject(reason));

      expect(error).toBeInstanceOf(NullishRejectionError);
      expect(error).toBeInstanceOf(Error);
      expect((error as NullishRejectionError).reason).toBe(reason);
      expect((error as NullishRejectionError).name).toBe('NullishRejectionError');
      expect((error as NullishRejectionError).message).toBe(`Promise rejected with ${reason}`);
      expect(result).toBe(null);
    });

    it('should never report a rejected promise as a success', async () => {
      const [error] = await tryCatch(Promise.reject(null));

      expect(error).not.toBe(null);
    });
  });

  describe('type narrowing', () => {
    it('should narrow the result when the error is checked against null', async () => {
      const [error, result] = await tryCatch(Promise.resolve({ name: 'foo' }));

      if (error !== null) {
        throw error;
      }

      // Compiles only when `result` is narrowed to `{ name: string }`
      const name: string = result.name;

      expect(name).toBe('foo');
    });

    it('should narrow the result by truthiness when the error type is an object', async () => {
      const [error, result] = await tryCatch<{ name: string }, Error>(Promise.resolve({ name: 'foo' }));

      if (error) {
        throw error;
      }

      const name: string = result.name;

      expect(name).toBe('foo');
    });

    it('should type the result slot with the default result type in both branches', async () => {
      const [error, result] = await tryCatch(Promise.reject<number>(new Error('boom')), 42);
      const value: number = result;

      expect(error).toBeInstanceOf(Error);
      expect(value).toBe(42);
    });
  });
});
