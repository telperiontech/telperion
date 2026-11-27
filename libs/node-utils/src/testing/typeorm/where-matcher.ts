import { FindOperator, type FindOperatorType, type FindOptionsWhere } from 'typeorm';

import { ColumnValues } from './column-values';
import { UnsupportedQueryError } from './unsupported-query-error';

/**
 * Matches rows against TypeORM `where` conditions in memory
 *
 * - A `where` object matches when all its properties match; an array of them when any of them matches.
 * - Plain values match by equality (dates by time).
 * - Operators: `IsNull`, `Not`, `Equal`, `In`, `Any`, `LessThan`, `LessThanOrEqual`, `MoreThan`,
 *   `MoreThanOrEqual`, `Between`, `Like`, `ILike`, `And`, `Or`. Others throw.
 * - Comparisons with a `null`/`undefined` column are false, as in SQL (only `IsNull()` matches them).
 * - `null` or `undefined` as a condition value throws, like TypeORM 1.x by default: use `IsNull()`.
 * - Nested conditions (relations) throw.
 */
export class WhereMatcher {
  static readonly #OPERATORS: Readonly<Partial<Record<FindOperatorType, (actual: unknown, operator: FindOperator<unknown>, key: string) => boolean>>> = {
    isNull: actual => ColumnValues.isNull(actual),
    equal: (actual, operator, key) => WhereMatcher.#matchesValue(actual, operator.child ?? operator.value, key),
    not: (actual, operator, key) =>
      operator.child?.type === 'isNull'
        ? !ColumnValues.isNull(actual)
        : !ColumnValues.isNull(actual) && !WhereMatcher.#matchesValue(actual, operator.child ?? operator.value, key),
    in: (actual, operator) => WhereMatcher.#includes(actual, operator.value),
    any: (actual, operator) => WhereMatcher.#includes(actual, operator.value),
    lessThan: (actual, operator) => WhereMatcher.#compares(actual, operator.value, order => order < 0),
    lessThanOrEqual: (actual, operator) => WhereMatcher.#compares(actual, operator.value, order => order <= 0),
    moreThan: (actual, operator) => WhereMatcher.#compares(actual, operator.value, order => order > 0),
    moreThanOrEqual: (actual, operator) => WhereMatcher.#compares(actual, operator.value, order => order >= 0),
    between: (actual, operator) => {
      const [from, to] = operator.value as [unknown, unknown];

      return WhereMatcher.#compares(actual, from, order => order >= 0) && WhereMatcher.#compares(actual, to, order => order <= 0);
    },
    like: (actual, operator) => typeof actual === 'string' && WhereMatcher.#likePattern(operator.value as string, '').test(actual),
    ilike: (actual, operator) => typeof actual === 'string' && WhereMatcher.#likePattern(operator.value as string, 'i').test(actual),
    and: (actual, operator, key) => (operator.value as unknown[]).every(condition => WhereMatcher.#matchesValue(actual, condition, key)),
    or: (actual, operator, key) => (operator.value as unknown[]).some(condition => WhereMatcher.#matchesValue(actual, condition, key)),
  };

  /**
   * `true` when the row matches the conditions; no conditions (or an empty array) match every row
   */
  static matches<T>(row: T, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): boolean {
    return where === undefined
      || (Array.isArray(where)
        ? where.length === 0 || where.some(conditions => WhereMatcher.#matchesAll(row, conditions))
        : WhereMatcher.#matchesAll(row, where));
  }

  static #matchesAll<T>(row: T, conditions: FindOptionsWhere<T>): boolean {
    return Object.entries(conditions).every(([key, expected]) => WhereMatcher.#matchesValue((row as Record<string, unknown>)[key], expected, key));
  }

  static #matchesValue(actual: unknown, expected: unknown, key: string): boolean {
    if (ColumnValues.isNull(expected)) {
      throw new UnsupportedQueryError(`where.${key} is ${expected}: use IsNull() to match empty columns`);
    }

    if (expected instanceof FindOperator) {
      const match = WhereMatcher.#OPERATORS[expected.type];

      if (!match) {
        throw new UnsupportedQueryError(`MemoryRepository does not support the ${expected.type} operator (where.${key})`);
      }

      return match(actual, expected, key);
    }

    if (typeof expected === 'object' && !(expected instanceof Date)) {
      throw new UnsupportedQueryError(`MemoryRepository does not support nested where conditions (where.${key})`);
    }

    return ColumnValues.equals(actual, expected);
  }

  /**
   * `IN (…)`: a `NULL` column never matches
   */
  static #includes(actual: unknown, values: unknown): boolean {
    return !ColumnValues.isNull(actual) && (values as unknown[]).some(value => ColumnValues.equals(actual, value));
  }

  /**
   * Compares a non-`NULL` column with a value
   */
  static #compares(actual: unknown, value: unknown, accept: (order: number) => boolean): boolean {
    return !ColumnValues.isNull(actual) && accept(ColumnValues.compare(actual, value));
  }

  /**
   * SQL `LIKE` pattern as a regular expression: `%` any text, `_` one character, `\` escapes them
   */
  static #likePattern(pattern: string, flags: string): RegExp {
    const source = pattern.replace(
      /\\([%_\\])|([%_])|([.*+?^${}()|[\]\\/])/g,
      (_, escaped: string | undefined, wildcard: string | undefined, special: string | undefined) =>
        escaped ? escaped.replace('\\', '\\\\') : wildcard ? (wildcard === '%' ? '.*' : '.') : `\\${special}`,
    );

    return new RegExp(`^${source}$`, `s${flags}`);
  }
}
