import type { FindOptionsOrder, FindOptionsOrderValue } from 'typeorm';

import { ColumnValues } from './column-values';
import { UnsupportedQueryError } from './unsupported-query-error';

/**
 * Sorts rows by a TypeORM `order` option in memory
 *
 * - Several keys sort in the order they are written.
 * - Directions: `'ASC'`, `'asc'`, `1`, `'DESC'`, `'desc'`, `-1`, or `{ direction, nulls }`.
 * - `NULL` columns sort last in ascending and first in descending order (PostgreSQL's default),
 *   unless `nulls` says otherwise.
 * - Ordering by relations (nested objects) throws.
 */
export class FindOrder {
  /**
   * Sorted copy of the rows
   */
  static sort<T>(rows: readonly T[], order: FindOptionsOrder<T> = {}): T[] {
    const keys = Object.entries(order).map(([key, value]) => ({ key, ...FindOrder.#direction(key, value) }));

    return [...rows].sort((a, b) =>
      keys.reduce(
        (result, { key, sign, nullsFirst }) => result || FindOrder.#compare((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], sign, nullsFirst),
        0,
      ),
    );
  }

  static #direction(key: string, value: unknown): { sign: 1 | -1; nullsFirst: boolean } {
    const { direction, nulls } = FindOrder.#normalize(key, value);
    const sign = String(direction).toUpperCase() === 'DESC' || direction === -1 ? -1 : 1;

    return { sign, nullsFirst: nulls ? nulls.toUpperCase() === 'FIRST' : sign === -1 };
  }

  static #normalize(key: string, value: unknown): { direction?: unknown; nulls?: string } {
    const isOptions = typeof value === 'object' && value !== null && Object.keys(value).every(name => name === 'direction' || name === 'nulls');

    if (typeof value === 'object' && value !== null && !isOptions) {
      throw new UnsupportedQueryError(`MemoryRepository does not support ordering by relations (order.${key})`);
    }

    return isOptions ? (value as Exclude<FindOptionsOrderValue, string | number>) : { direction: value };
  }

  static #compare(a: unknown, b: unknown, sign: 1 | -1, nullsFirst: boolean): number {
    const aNull = ColumnValues.isNull(a);
    const bNull = ColumnValues.isNull(b);

    return aNull || bNull
      ? Number(aNull && !bNull) * (nullsFirst ? -1 : 1) + Number(bNull && !aNull) * (nullsFirst ? 1 : -1)
      : sign * ColumnValues.compare(a, b);
  }
}
