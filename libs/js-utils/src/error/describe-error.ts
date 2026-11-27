/**
 * How deep {@link describeError} follows `cause` and `AggregateError#errors` before it stops
 */
const MAX_DEPTH = 5;

/**
 * Message of an error-like value: `message` when it is a non-empty string, else `name` for errors
 */
function ownMessage(error: object): string | undefined {
  const { message, name } = error as { message?: unknown; name?: unknown };

  return typeof message === 'string' && message !== ''
    ? message
    : error instanceof Error && typeof name === 'string'
      ? name
      : undefined;
}

/**
 * Text for an object that is neither an error nor has a message: its JSON, else `String()`, else its tag
 */
function stringify(value: object): string {
  const attempts = [
    () => (Array.isArray(value) ? undefined : JSON.stringify(value)),
    () => String(value),
    () => Object.prototype.toString.call(value),
  ];

  return attempts.reduce<string | undefined>((text, attempt) => text ?? tryText(attempt), undefined) ?? '[unknown error]';
}

function tryText(attempt: () => string | undefined): string | undefined {
  try {
    return attempt();
  } catch {
    return undefined;
  }
}

function describe(error: unknown, seen: ReadonlySet<unknown>, depth: number): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  if (seen.has(error) || depth > MAX_DEPTH) {
    return '…';
  }

  const nextSeen = new Set(seen).add(error);
  const inner = (value: unknown) => describe(value, nextSeen, depth + 1);
  const { errors, cause } = error as { errors?: unknown; cause?: unknown };
  const aggregated = error instanceof AggregateError && Array.isArray(errors) && errors.length > 0
    ? ` [${errors.map(inner).join('; ')}]`
    : '';
  const caused = error instanceof Error && cause !== undefined ? `; caused by: ${inner(cause)}` : '';

  return `${ownMessage(error) ?? stringify(error)}${aggregated}${caused}`;
}

/**
 * #### Describe Error
 *
 * Turns any thrown value into a message for logs and wrapped errors. Never throws, always returns a string.
 *
 * - `Error`: its `message`, or its `name` when the message is empty
 * - `AggregateError`: its message followed by the inner errors in brackets
 * - an `Error` with a `cause`: its message followed by `; caused by: <cause>`
 * - any other object with a string `message` (e.g. a plain `{ message }` from an API): that message
 * - strings and other primitives: `String(value)`
 * - other objects: their JSON, or `String(value)` when they can't be serialized
 *
 * Nested causes and aggregated errors are followed up to 5 levels deep and cycles are cut with `…`.
 *
 * #### Example
 * ```typescript
 * import { describeError } from "@telperion/js-utils/error";
 *
 * try {
 *   await connect();
 * } catch (error) {
 *   throw new Error(`Could not connect: ${describeError(error)}`, { cause: error });
 * }
 *
 * describeError(new Error('Request failed', { cause: new Error('ECONNRESET') }));
 * // 'Request failed; caused by: ECONNRESET'
 * describeError(new AggregateError([new Error('a'), 'b'], 'All failed'));
 * // 'All failed [a; b]'
 * describeError('plain string'); // 'plain string'
 * describeError(undefined); // 'undefined'
 * ```
 *
 * @param error - Any thrown or rejected value
 * @returns A human readable description of the value
 */
export function describeError(error: unknown): string {
  // A throwing getter or a revoked proxy must not break error handling
  return tryText(() => describe(error, new Set(), 0)) ?? tryText(() => Object.prototype.toString.call(error)) ?? '[unknown error]';
}
