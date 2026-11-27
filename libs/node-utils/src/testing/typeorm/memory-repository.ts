import { randomUUID } from 'node:crypto';

import {
  EntityNotFoundError,
  type DeepPartial,
  type DeleteResult,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
  type UpdateResult,
} from 'typeorm';

import { ColumnValues } from './column-values';
import { FindOrder } from './find-order';
import { UnsupportedQueryError } from './unsupported-query-error';
import { WhereMatcher } from './where-matcher';

/**
 * Options of a {@link MemoryRepository}
 */
export interface MemoryRepositoryOptions<T> {
  /**
   * Name used in `EntityNotFoundError` messages
   *
   * @default 'Entity'
   */
  name?: string;

  /**
   * Primary key column
   *
   * @default 'id'
   */
  primaryKey?: keyof T & string;

  /**
   * Creates the primary key of rows saved without one
   *
   * @default randomUUID
   */
  generateId?: () => unknown;

  /**
   * Column `save` fills with the current date when it inserts a row without it, like `@CreateDateColumn()`
   */
  createDateColumn?: keyof T & string;

  /**
   * Column `save` and `update` set to the current date, like `@UpdateDateColumn()`
   */
  updateDateColumn?: keyof T & string;
}

/**
 * Criteria of `update` and `delete`: primary key values, or `where` conditions
 */
export type MemoryRepositoryCriteria<T> =
  | string
  | number
  | Date
  | readonly (string | number | Date)[]
  | FindOptionsWhere<T>
  | FindOptionsWhere<T>[];

/**
 * Just enough of a TypeORM `Repository` for unit tests, keeping rows in an array
 *
 * Supported: `create`, `save` (one entity or an array), `find`, `findBy`, `findOne`, `findOneBy`, `findOneOrFail`,
 * `findOneByOrFail`, `findAndCount`, `count`, `countBy`, `exists`, `existsBy`, `update`, `delete`, `remove` and `clear`.
 *
 * - `where`: objects or arrays of objects (OR), with plain equality and the operators `IsNull`, `Not`, `Equal`, `In`,
 *   `Any`, `LessThan`, `LessThanOrEqual`, `MoreThan`, `MoreThanOrEqual`, `Between`, `Like`, `ILike`, `And` and `Or`.
 *   `Like` is case-sensitive (as in PostgreSQL), `ILike` is not. Comparisons with `NULL` columns are false, as in SQL.
 * - `find` options: `where`, `order` (several keys, directions and `nulls`), `skip` and `take`. Others are ignored.
 * - Anything else (`Raw()`, array and JSON operators, relations in `where`/`order`, `null`/`undefined` as a
 *   condition value) throws a {@link MemoryRepository.UnsupportedQueryError}.
 *
 * Rows are the entity objects themselves: `save` stores (and fills in) the entity it receives, as TypeORM does,
 * and `find` returns the stored objects. `rows` exposes them for assertions and seeding.
 *
 * ```typescript
 * import { IsNull } from 'typeorm';
 * import { MemoryRepository } from '@telperion/node-utils/testing/typeorm';
 *
 * const users = new MemoryRepository<User>({ createDateColumn: 'createdAt', updateDateColumn: 'updatedAt' });
 * const service = new UserService(users.asRepository());
 *
 * await users.save(users.create({ email: 'a@example.com', deletedAt: null }));
 * await service.findActive(); // uses `findBy({ deletedAt: IsNull() })`
 *
 * expect(users.rows).toHaveLength(1);
 * ```
 */
export class MemoryRepository<T extends ObjectLiteral> {
  /**
   * @see UnsupportedQueryError
   */
  static readonly UnsupportedQueryError = UnsupportedQueryError;

  /**
   * Stored rows
   */
  readonly rows: T[] = [];

  readonly #name: string;
  readonly #primaryKey: keyof T & string;
  readonly #generateId: () => unknown;
  readonly #createDateColumn?: keyof T & string;
  readonly #updateDateColumn?: keyof T & string;

  constructor({
    name = 'Entity',
    primaryKey = 'id',
    generateId = randomUUID,
    createDateColumn,
    updateDateColumn,
  }: MemoryRepositoryOptions<T> = {}) {
    this.#name = name;
    this.#primaryKey = primaryKey;
    this.#generateId = generateId;
    this.#createDateColumn = createDateColumn;
    this.#updateDateColumn = updateDateColumn;
  }

  /**
   * Casts to the TypeORM type the code under test injects
   */
  asRepository(): Repository<T> {
    return this as unknown as Repository<T>;
  }

  /**
   * A new entity object with the given properties; nothing is stored
   */
  create(data: DeepPartial<T> = {} as DeepPartial<T>): T {
    return { ...data } as unknown as T;
  }

  /**
   * Inserts entities without a stored primary key, replaces the others.
   * Fills in the primary key and the date columns on the given objects.
   */
  save<E extends DeepPartial<T>>(entities: E[]): Promise<(E & T)[]>;
  save<E extends DeepPartial<T>>(entity: E): Promise<E & T>;
  save<E extends DeepPartial<T>>(entityOrEntities: E | E[]): Promise<(E & T) | (E & T)[]> {
    const now = new Date();

    return MemoryRepository.#settle(() =>
      Array.isArray(entityOrEntities)
        ? entityOrEntities.map(entity => this.#saveOne(entity, now))
        : this.#saveOne(entityOrEntities, now),
    );
  }

  find(options: FindManyOptions<T> = {}): Promise<T[]> {
    return MemoryRepository.#settle(() => this.#find(options));
  }

  findBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]> {
    return this.find({ where });
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return MemoryRepository.#settle(() => this.#find({ ...options, take: 1 })[0] ?? null);
  }

  findOneBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
    return this.findOne({ where });
  }

  /**
   * @throws EntityNotFoundError when no row matches
   */
  findOneOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.findOne(options).then(row => row ?? this.#notFound(options));
  }

  /**
   * @throws EntityNotFoundError when no row matches
   */
  findOneByOrFail(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T> {
    return this.findOneBy(where).then(row => row ?? this.#notFound(where));
  }

  /**
   * The page of rows `skip`/`take` select, and the number of all matching rows
   */
  findAndCount(options: FindManyOptions<T> = {}): Promise<[T[], number]> {
    return MemoryRepository.#settle(() => [this.#find(options), this.#find({ where: options.where }).length]);
  }

  count(options: FindManyOptions<T> = {}): Promise<number> {
    return MemoryRepository.#settle(() => this.#find(options).length);
  }

  countBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number> {
    return this.count({ where });
  }

  exists(options: FindManyOptions<T> = {}): Promise<boolean> {
    return MemoryRepository.#settle(() => this.#find(options).length > 0);
  }

  existsBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<boolean> {
    return this.exists({ where });
  }

  /**
   * Applies the patch to the matching rows. Like TypeORM, criteria may also be primary key values.
   *
   * @throws UnsupportedQueryError for empty criteria, which TypeORM rejects too
   */
  update(criteria: MemoryRepositoryCriteria<T>, patch: DeepPartial<T>): Promise<UpdateResult> {
    return MemoryRepository.#settle(() => {
      const where = this.#where(criteria, 'update');
      const targets = this.rows.filter(row => WhereMatcher.matches(row, where));
      const stamp = this.#updateDateColumn ? { [this.#updateDateColumn]: new Date() } : {};

      targets.forEach(row => Object.assign(row, patch, stamp));

      return { raw: [], affected: targets.length, generatedMaps: [] };
    });
  }

  /**
   * Removes the matching rows. Like TypeORM, criteria may also be primary key values.
   *
   * @throws UnsupportedQueryError for empty criteria, which TypeORM rejects too
   */
  delete(criteria: MemoryRepositoryCriteria<T>): Promise<DeleteResult> {
    return MemoryRepository.#settle(() => {
      const where = this.#where(criteria, 'delete');

      return { raw: [], affected: this.#removeWhere(row => WhereMatcher.matches(row, where)) };
    });
  }

  /**
   * Removes the given entities by primary key
   */
  remove(entities: T[]): Promise<T[]>;
  remove(entity: T): Promise<T>;
  remove(entityOrEntities: T | T[]): Promise<T | T[]> {
    const keys = new Set((Array.isArray(entityOrEntities) ? entityOrEntities : [entityOrEntities]).map(entity => entity[this.#primaryKey]));

    return MemoryRepository.#settle(() => {
      this.#removeWhere(row => keys.has(row[this.#primaryKey]));

      return entityOrEntities;
    });
  }

  /**
   * Removes all rows
   */
  clear(): Promise<void> {
    return MemoryRepository.#settle(() => {
      this.rows.splice(0);
    });
  }

  #find({ where, order, skip = 0, take }: FindManyOptions<T>): T[] {
    const matching = this.rows.filter(row => WhereMatcher.matches(row, where));

    return FindOrder.sort(matching, order).slice(skip, take === undefined ? undefined : skip + take);
  }

  #saveOne<E extends DeepPartial<T>>(entity: E, now: Date): E & T {
    const record = entity as Record<string, unknown>;
    const index = !ColumnValues.isNull(record[this.#primaryKey]) ? this.rows.findIndex(row => row[this.#primaryKey] === record[this.#primaryKey]) : -1;

    record[this.#primaryKey] ??= this.#generateId();

    if (index === -1 && this.#createDateColumn) {
      record[this.#createDateColumn] ??= now;
    }

    if (this.#updateDateColumn) {
      record[this.#updateDateColumn] = now;
    }

    this.rows.splice(index === -1 ? this.rows.length : index, index === -1 ? 0 : 1, record as T);

    return entity as E & T;
  }

  /**
   * Turns `update`/`delete` criteria into `where` conditions
   */
  #where(criteria: MemoryRepositoryCriteria<T>, method: string): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const where = Array.isArray(criteria)
      ? criteria.map(item => (MemoryRepository.#isKey(item) ? this.#byKey(item) : (item as FindOptionsWhere<T>)))
      : MemoryRepository.#isKey(criteria) ? this.#byKey(criteria) : (criteria as FindOptionsWhere<T>);

    if (Array.isArray(where) ? where.length === 0 : Object.keys(where).length === 0) {
      throw new UnsupportedQueryError(`Empty criteria are not allowed for the ${method} method`);
    }

    return where;
  }

  #byKey(key: string | number | Date): FindOptionsWhere<T> {
    return { [this.#primaryKey]: key } as FindOptionsWhere<T>;
  }

  /**
   * Removes the rows the predicate selects and returns how many there were
   */
  #removeWhere(predicate: (row: T) => boolean): number {
    const kept = this.rows.filter(row => !predicate(row));
    const removed = this.rows.length - kept.length;

    this.rows.splice(0, this.rows.length, ...kept);

    return removed;
  }

  #notFound(criteria: unknown): never {
    throw new EntityNotFoundError(this.#name, criteria);
  }

  /**
   * Runs the work and settles a promise with its result, so errors reject like TypeORM's async methods
   */
  static #settle<R>(work: () => R): Promise<R> {
    return new Promise<R>(resolve => resolve(work()));
  }

  /**
   * `true` for primary key values given as `update`/`delete` criteria (as opposed to `where` objects)
   */
  static #isKey(value: unknown): value is string | number | Date {
    return typeof value === 'string' || typeof value === 'number' || value instanceof Date;
  }
}

