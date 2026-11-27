
import './try-catch';

describe('Promise Try Catch Proto Function', () => {
  it('should resolve when its resolved', done => {
    Promise.resolve('foo')
      .tryCatch()
      .then(([error, result]) => {
        expect(error).toBe(null);
        expect(result).toBe('foo');
        done();
      });
  });

  it('should reject when its rejected', done => {
    Promise.reject('foo')
      .tryCatch()
      .then(([error, result]) => {
        expect(error).toBe('foo');
        expect(result).toBe(null);
        done();
      });
  });

  it('should put the default result into the result slot when rejected', async () => {
    const [error, result] = await Promise.reject<string>('foo').tryCatch('default');

    expect(error).toBe('foo');
    expect(result).toBe('default');
  });

  it('should narrow the result when the error is checked against null', async () => {
    const [error, result] = await Promise.resolve({ name: 'foo' }).tryCatch();

    if (error !== null) {
      throw error;
    }

    const name: string = result.name;

    expect(name).toBe('foo');
  });
});
