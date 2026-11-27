import { retry } from './retry';

describe('Retry Function', () => {
  it('should resolve on the first try without retrying', async () => {
    const task = jest.fn(() => Promise.resolve('foo'));

    await expect(retry(task)).resolves.toBe('foo');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should resolve after n failures', async () => {
    const task = jest.fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('done');

    await expect(retry(task, { count: 3 })).resolves.toBe('done');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('should give up after `count` retries and reject with the last error', async () => {
    const task = jest.fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValue('too late');

    await expect(retry(task, { count: 2 })).rejects.toThrow('3');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('should retry 3 times by default', async () => {
    const task = jest.fn(() => Promise.reject(new Error('nope')));

    await expect(retry(task)).rejects.toThrow('nope');
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('should run the task once when count is 0 or negative', async () => {
    const zero = jest.fn(() => Promise.reject(new Error('nope')));
    const negative = jest.fn(() => Promise.reject(new Error('nope')));

    await expect(retry(zero, { count: 0 })).rejects.toThrow('nope');
    await expect(retry(negative, { count: -1 })).rejects.toThrow('nope');
    expect(zero).toHaveBeenCalledTimes(1);
    expect(negative).toHaveBeenCalledTimes(1);
  });

  it('should stop immediately when `when` returns false', async () => {
    const fatal = new Error('fatal');
    const task = jest.fn(() => Promise.reject(fatal));
    const when = jest.fn(() => false);

    await expect(retry(task, { count: 5, when })).rejects.toBe(fatal);
    expect(task).toHaveBeenCalledTimes(1);
    expect(when).toHaveBeenCalledWith(fatal, 1);
  });

  it('should retry only the errors `when` accepts', async () => {
    const task = jest.fn<Promise<string>, []>()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new RangeError('bad input'))
      .mockResolvedValue('never reached');

    await expect(retry(task, { count: 5, when: error => error instanceof TypeError })).rejects.toThrow(RangeError);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('should count a synchronous throw as a failed attempt', async () => {
    const task = jest.fn<Promise<string>, []>()
      .mockImplementationOnce(() => {
        throw new Error('sync');
      })
      .mockResolvedValue('done');

    await expect(retry(task)).resolves.toBe('done');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('should accept tasks returning plain values', async () => {
    await expect(retry(() => 'plain')).resolves.toBe('plain');
  });

  describe('delay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait the given milliseconds between attempts', async () => {
      const task = jest.fn<Promise<string>, []>()
        .mockRejectedValueOnce(new Error('1'))
        .mockResolvedValue('done');
      const result = retry(task, { delay: 1000 });

      await jest.advanceTimersByTimeAsync(999);
      expect(task).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(task).toHaveBeenCalledTimes(2);
      await expect(result).resolves.toBe('done');
    });

    it('should pass the retry number (starting at 1) and the error to the delay function', async () => {
      const errors = [new Error('1'), new Error('2'), new Error('3')];
      const task = jest.fn<Promise<string>, []>()
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockRejectedValueOnce(errors[2])
        .mockResolvedValue('done');
      const delay = jest.fn((attempt: number) => 1000 * 2 ** attempt);
      const result = retry(task, { count: 3, delay });

      await jest.advanceTimersByTimeAsync(2000);
      expect(task).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(4000);
      expect(task).toHaveBeenCalledTimes(3);

      await jest.advanceTimersByTimeAsync(8000);
      expect(task).toHaveBeenCalledTimes(4);

      await expect(result).resolves.toBe('done');
      expect(delay.mock.calls).toEqual([
        [1, errors[0]],
        [2, errors[1]],
        [3, errors[2]],
      ]);
    });

    it('should not wait after the last failed attempt', async () => {
      const task = jest.fn(() => Promise.reject(new Error('nope')));
      const delay = jest.fn(() => 1000);
      const result = retry(task, { count: 1, delay });
      const settled = expect(result).rejects.toThrow('nope');

      await jest.advanceTimersByTimeAsync(1000);
      await settled;
      expect(delay).toHaveBeenCalledTimes(1);
    });
  });
});
