import {
  catchError,
  concatAll,
  defer,
  EMPTY,
  ignoreElements,
  Observable,
  ReplaySubject,
  Subject,
  takeUntil,
  tap,
  type ObservableInput,
} from 'rxjs';

/**
 * Runs tasks one at a time, in the order they were subscribed: a task starts once every earlier
 * one has completed, errored or been unsubscribed.
 *
 * `run(task)` returns a cold Observable. Each subscription queues `task`, a factory that is only
 * called when the task's turn comes, and relays its values, error and completion to that
 * subscriber. A task's error goes to its own subscriber only; the queue moves on to the next task.
 * Unsubscribing cancels a running task and starts the next one, or drops a waiting task so its
 * factory is never called.
 *
 * `complete()` closes the queue: tasks already queued still run, and later subscriptions to
 * `run()` error at once.
 *
 * @example
 * ```ts
 * import { SerialQueue } from '@telperion/rx-utils/serial-queue';
 *
 * const queue = new SerialQueue();
 *
 * // The second request starts only once the first has settled
 * queue.run(() => fetch('/api/a')).subscribe((response) => console.log('a', response.status));
 * queue.run(() => fetch('/api/b')).subscribe((response) => console.log('b', response.status));
 * ```
 */
export class SerialQueue {
  readonly #tasks$ = new Subject<Observable<never>>();
  #closed = false;

  constructor() {
    // The queue's drain: it holds nothing but pending tasks, so it lives as long as this object
    this.#tasks$.pipe(concatAll()).subscribe();
  }

  /** Whether `complete()` has been called: `run()` no longer accepts tasks */
  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Queues `task` on every subscription to the returned Observable.
   *
   * @param task - Called when the task's turn comes; its Observable, promise or other input is the task
   * @returns A cold Observable of the task's values, error and completion
   */
  run<T>(task: () => ObservableInput<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (this.closed) {
        subscriber.error(new Error('SerialQueue is complete and accepts no new tasks'));

        return;
      }

      // Replays, so a task unsubscribed before its turn is skipped when the queue reaches it
      const cancelled$ = new ReplaySubject<void>(1);

      this.#tasks$.next(
        defer(task).pipe(
          tap(subscriber),
          ignoreElements(),
          // The subscriber got the error; the queue moves on
          catchError(() => EMPTY),
          takeUntil(cancelled$),
        ),
      );

      return () => cancelled$.next();
    });
  }

  /** Stops accepting tasks. Tasks already queued still run; later `run()` subscriptions error at once. */
  complete(): void {
    this.#closed = true;
    this.#tasks$.complete();
  }
}
