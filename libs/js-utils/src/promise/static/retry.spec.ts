import './retry';

import { retry } from '../retry';

describe('Retry Static Function', () => {
  it('should be the retry function', () => {
    expect(Promise.retry).toBe(retry);
  });

  it('should retry a failing task', async () => {
    const task = jest.fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('1'))
      .mockResolvedValue('done');

    await expect(Promise.retry(task)).resolves.toBe('done');
    expect(task).toHaveBeenCalledTimes(2);
  });
});
