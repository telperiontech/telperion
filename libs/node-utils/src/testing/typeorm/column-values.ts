/**
 * Compares column values the way a database does for the types tests use: numbers, strings, bigints and dates
 */
export class ColumnValues {
  /**
   * `true` when both values are equal; dates compare by time
   */
  static equals(actual: unknown, expected: unknown): boolean {
    return actual instanceof Date && expected instanceof Date ? actual.getTime() === expected.getTime() : actual === expected;
  }

  /**
   * Negative when `a` sorts before `b`, positive when after, `0` when equal
   */
  static compare(a: unknown, b: unknown): number {
    const left = ColumnValues.#comparable(a);
    const right = ColumnValues.#comparable(b);

    return left < right ? -1 : left > right ? 1 : 0;
  }

  /**
   * `true` for `null` and `undefined`, which behave like SQL `NULL`
   */
  static isNull(value: unknown): value is null | undefined {
    return value === null || value === undefined;
  }

  static #comparable(value: unknown): number | string | bigint {
    return value instanceof Date ? value.getTime() : (value as number | string | bigint);
  }
}
