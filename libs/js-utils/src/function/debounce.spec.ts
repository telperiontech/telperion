
import { debounce, DEFAULT_DEBOUNCE_TIME } from './debounce';

class CustomError {
  constructor(public message: string) {}
}

/**
 * Node timers are scheduled against libuv's cached loop time, and `Date` has
 * 1ms resolution, so a timer may appear to fire a few ms "early" when measured
 * with `Date`. Allow that much jitter in elapsed-time assertions.
 */
const TIMER_JITTER = 5;

describe('Debounce Function', () => {
  let foo = 0;

  function bar() {
    foo++;
  }

  beforeEach(() => {
    foo = 0;
  });

  it('should debounce functions', async () => {
    debounce(bar);
    debounce(bar);

    await debounce(bar);

    expect(foo).toBe(1);
  });

  it('should wait the debouncing time to execute function', async () => {
    const started = Date.now();

    await debounce(bar);

    expect(foo).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(DEFAULT_DEBOUNCE_TIME - TIMER_JITTER);
  });

  it('should debounce by given time', async () => {
    const started = Date.now();

    await debounce(bar, 50);

    expect(foo).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(50 - TIMER_JITTER);
  });

  it('should use passed this object', async () => {
    const john = { x: 0 };

    function baz(this: { x: number }) {
      this.x++;
    }

    await debounce(baz, undefined, john);

    expect(john.x).toBe(1);
  });

  it('should use passed arguments', async () => {
    let john: number | undefined;

    function baz(a: number, b: number) {
      john = a + b;
    }

    await debounce(baz, undefined, undefined, 5, 3);

    expect(john).toBe(8);
  });

  it('should throw the callback error if thrown', async () => {
    function baz() {
      throw new CustomError('baz error');
    }

    await expect(debounce(baz)).rejects.toEqual(new CustomError('baz error'));
  });
});
