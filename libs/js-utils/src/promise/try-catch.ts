/**
 * Result tuple of {@link tryCatch}
 *
 * A discriminated union, so checking the error slot narrows the result slot:
 * - `[error, fallback]` when the promise rejected. `error` is never `null` or `undefined`.
 * - `[null, result]` when the promise resolved.
 *
 * `error !== null` always narrows. A plain truthiness check (`if (error)`) narrows too when `E` is a type that
 * can't be falsy (e.g. `Error`); with the default `unknown` error type TypeScript can't rule out falsy errors
 * like `0` or `''`, so use `error !== null` there.
 *
 * @template T Type of the resolved value
 * @template E Type of the rejection reason
 * @template F Type of the result slot when the promise rejects (`null`, or the type of the default result)
 */
export type TryCatchResult<T, E = unknown, F = null> = [error: NonNullable<E>, result: F] | [error: null, result: T];

/**
 * Put in the error slot of {@link tryCatch} when a promise rejects with `null` or `undefined`,
 * because `null` in the error slot means success.
 */
export class NullishRejectionError extends Error {
  override readonly name = 'NullishRejectionError';

  /**
   * @param reason The original rejection reason (`null` or `undefined`)
   */
  constructor(readonly reason: null | undefined) {
    super(`Promise rejected with ${reason}`);
  }
}

/**
 * #### Try Catch
 *
 * Merges result and error in the same callback
 *
 * The result is a discriminated union ({@link TryCatchResult}): checking the error narrows the result.
 * A promise rejecting with `null` or `undefined` gets a {@link NullishRejectionError} in the error slot,
 * so a `null` error always means success.
 *
 * * * *
 * Example:
 * ```typescript
 * import { tryCatch } from "@telperion/js-utils/promise";
 *
 * async function fooFunction() {
 *   const [error, result] = await tryCatch(anAsyncCall());
 *
 *   if (error !== null) {
 *     // handle error
 *     return;
 *   }
 *
 *   result; // narrowed to the resolved type
 * }
 *
 * // With an object error type, a truthiness check narrows as well
 * const [error, user] = await tryCatch<User, Error>(getUser());
 *
 * if (error) throw error;
 *
 * user; // User
 * ```
 *
 * Prototype Example:
 * ```typescript
 * import "@telperion/js-utils/promise/proto/try-catch";
 *
 * async function fooFunction() {
 *   const [error, result] = await anAsyncCall().tryCatch();
 *
 *   if (error !== null) {
 *     // handle error
 *   }
 *
 *   // do stuff
 * }
 *
 * ```
 * * * *
 * @param promise Promise to try
 * @param defaultResult Setting this will put the value into the result field when the promise throws error
 * @returns Error and result tuple
 */
export function tryCatch<T, E = unknown>(promise: Promise<T>): Promise<TryCatchResult<T, E>>
export function tryCatch<T, E = unknown>(promise: Promise<T>, defaultResult: T): Promise<TryCatchResult<T, E, T>>
export function tryCatch<T, E = unknown>(promise: Promise<T>, defaultResult?: T): Promise<TryCatchResult<T, E, T | null>> {
  return promise.then(
    (result): TryCatchResult<T, E, T | null> => [null, result],
    (error: E | null | undefined): TryCatchResult<T, E, T | null> => [
      (error ?? new NullishRejectionError(error as null | undefined)) as NonNullable<E>,
      defaultResult ?? null,
    ],
  );
}
