import { firstValueFrom, lastValueFrom, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { SerialQueue } from './serial-queue';

/** A promise the test settles by hand */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));

  return { promise, resolve };
}

/** Lets pending promise callbacks run */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('SerialQueue', () => {
  it('runs overlapping async tasks one at a time, in subscription order', async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    const releaseFirst = deferred();
    const first = lastValueFrom(
      queue.run(async () => {
        log.push('first start');
        await releaseFirst.promise;
        log.push('first end');

        return 1;
      }),
    );
    const second = lastValueFrom(
      queue.run(async () => {
        log.push('second start');

        return 2;
      }),
    );

    await flush();
    expect(log).toEqual(['first start']);

    releaseFirst.resolve();

    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(log).toEqual(['first start', 'first end', 'second start']);
  });

  it('relays every value and the completion of a task', async () => {
    const queue = new SerialQueue();
    const values: number[] = [];
    const complete = jest.fn();

    queue.run(() => of(1, 2, 3)).subscribe({ next: (value) => values.push(value), complete });

    expect(values).toEqual([1, 2, 3]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('sends a task error to its own subscriber only and runs the next task', async () => {
    const queue = new SerialQueue();
    const error = new Error('boom');
    const failing = firstValueFrom(queue.run(() => throwError(() => error)));
    const next = firstValueFrom(queue.run(() => of('next')));

    await expect(failing).rejects.toBe(error);
    await expect(next).resolves.toBe('next');
  });

  it('treats a factory that throws as a failed task', async () => {
    const queue = new SerialQueue();
    const error = new Error('thrown');
    const failing = firstValueFrom(
      queue.run(() => {
        throw error;
      }),
    );

    await expect(failing).rejects.toBe(error);
    await expect(firstValueFrom(queue.run(() => of('next')))).resolves.toBe('next');
  });

  it('drops a task unsubscribed before its turn without calling its factory', () => {
    const queue = new SerialQueue();
    const blocker = new Subject<void>();
    const dropped = jest.fn(() => of('dropped'));
    const after = jest.fn();

    queue.run(() => blocker).subscribe();

    const subscription = queue.run(dropped).subscribe();
    queue.run(() => of('after')).subscribe(after);

    subscription.unsubscribe();
    blocker.complete();

    expect(dropped).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledWith('after');
  });

  it('cancels a running task on unsubscribe and starts the next one', () => {
    const queue = new SerialQueue();
    const teardown = jest.fn();
    const after = jest.fn();
    const subscription = queue.run(() => new Observable<never>(() => teardown)).subscribe();
    queue.run(() => of('after')).subscribe(after);

    expect(after).not.toHaveBeenCalled();

    subscription.unsubscribe();

    expect(teardown).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledWith('after');
  });

  it('queues nothing until the returned Observable is subscribed', () => {
    const queue = new SerialQueue();
    const factory = jest.fn(() => of(1));
    const task$ = queue.run(factory);

    expect(factory).not.toHaveBeenCalled();

    // An unsubscribed run() does not hold up later tasks
    const after = jest.fn();
    queue.run(() => of('after')).subscribe(after);
    expect(after).toHaveBeenCalledWith('after');

    task$.subscribe();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('queues the task again on every subscription', () => {
    const queue = new SerialQueue();
    const factory = jest.fn(() => of(1));
    const task$ = queue.run(factory);

    task$.subscribe();
    task$.subscribe();

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('accepts promise-returning tasks', async () => {
    const queue = new SerialQueue();

    await expect(firstValueFrom(queue.run(() => Promise.resolve('value')))).resolves.toBe('value');
    await expect(firstValueFrom(queue.run(() => Promise.reject(new Error('rejected'))))).rejects.toThrow('rejected');
  });

  describe('complete()', () => {
    it('lets queued tasks finish and refuses new ones', () => {
      const queue = new SerialQueue();
      const blocker = new Subject<string>();
      const queued = jest.fn();
      const refused = jest.fn();

      queue.run(() => blocker).subscribe();
      queue.run(() => of('queued')).subscribe(queued);

      queue.complete();
      expect(queue.closed).toBe(true);

      queue.run(() => of('refused')).subscribe({ next: refused, error: refused });
      expect(refused).toHaveBeenCalledWith(expect.any(Error));

      blocker.complete();
      expect(queued).toHaveBeenCalledWith('queued');
    });

    it('still drops a queued task unsubscribed after complete()', () => {
      const queue = new SerialQueue();
      const factory = jest.fn(() => NEVER);

      queue.run(() => of(1)).subscribe();

      const blocked = queue.run(() => NEVER).subscribe();
      const dropped = queue.run(factory).subscribe();

      queue.complete();
      dropped.unsubscribe();
      blocked.unsubscribe();

      expect(factory).not.toHaveBeenCalled();
    });
  });
});
