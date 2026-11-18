/* eslint-disable @typescript-eslint/no-explicit-any */

import { SmartMap } from "@telperion/js-utils/smart-map";
import { call } from "@telperion/js-utils/function/call";
import { timeout as jsTimeout } from "@telperion/js-utils/promise/timeout";

const LAST_JOB_MAP = new SmartMap<any, { lastJob: Promise<any> }>();

/**
 * ### TimeoutError
 *
 * Rejection reason of a `FifoPromise` call that ran longer than its `timeout`
 */
export class TimeoutError extends Error { }

/**
 * ### FifoPromiseProps
 *
 * Options of the `FifoPromise` decorator
 */
export interface FifoPromiseProps {
  /** Milliseconds to wait after the previous call settles before starting the next one. Defaults to `0` */
  delay?: number;
  /** Queue key: methods decorated with the same `group` share one queue. Defaults to a queue per decorated method */
  group?: any;
  /** Milliseconds a call may run before it is rejected with a `TimeoutError`. No limit by default */
  timeout?: number;
}

/**
 * ### FifoPromise
 *
 * Method decorator that queues calls to an async method and runs them one at a time, first in first out
 *
 * Each call waits for the previous one in its queue to settle (resolved or rejected), then for `delay`
 * milliseconds, before it starts. Pass the same `group` to several methods to serialize them together.
 * With `timeout`, a call that runs too long is rejected with a `TimeoutError` and the queue moves on;
 * the original method itself is not cancelled.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import { FifoPromise } from "@telperion/ts-utils/fifo-promise";
 *
 * const STORAGE = {};
 *
 * class Api {
 *   @FifoPromise({ delay: 100, timeout: 5000 })
 *   async save(data: Data) {
 *     await fetch("/save", { method: "POST", body: JSON.stringify(data) });
 *   }
 *
 *   @FifoPromise({ group: STORAGE })
 *   async read() { ... }
 *
 *   @FifoPromise({ group: STORAGE })
 *   async write(value: string) { ... }
 * }
 *
 * const api = new Api();
 *
 * api.save(a);
 * api.save(b); // starts 100ms after the first save settles
 * ```
 * * * *
 * @param options Queue delay, group and timeout
 * @returns A method decorator
 */
export function FifoPromise({ delay = 0, group = {}, timeout }: FifoPromiseProps = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let lastJobObj = LAST_JOB_MAP.get(group);

    if (!lastJobObj) LAST_JOB_MAP.set(group, lastJobObj = { lastJob: Promise.resolve() });

    descriptor.value = async function (...args: any[]) {
      return lastJobObj.lastJob = new Promise((resolve, reject) => {
        lastJobObj.lastJob.finally(() => {
          let timeoutKey: symbol;

          jsTimeout(delay)
            .then(() => {
              const tasks = [() => originalMethod.call(this, ...args)];

              if (timeout != null) {
                timeoutKey = Symbol();
                tasks.push(() => jsTimeout(timeout, undefined, timeoutKey).then(() => {
                  throw new TimeoutError('Fifo Promise timeout');
                }));
              }

              return Promise.race(tasks.map(call));
            })
            .then(value => {
              if (timeoutKey) {
                jsTimeout.cancel(timeoutKey);
              }

              resolve(value);
            })
            .catch(reject);
        });
      });
    };
  };
}
