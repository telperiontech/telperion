import {
  And,
  Any,
  ArrayContains,
  Between,
  Equal,
  ILike,
  In,
  IsNull,
  JsonContains,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Or,
  Raw,
  type FindOptionsWhere,
} from 'typeorm';

import { UnsupportedQueryError } from './unsupported-query-error';
import { WhereMatcher } from './where-matcher';

interface Row {
  id: string;
  name: string | null;
  age?: number | null;
  at?: Date;
}

const row: Row = { id: '1', name: 'Alice', age: 30, at: new Date('2026-01-15T00:00:00Z') };
const empty: Row = { id: '2', name: null, age: null };

function matches(where: FindOptionsWhere<Row> | FindOptionsWhere<Row>[], target: Row = row): boolean {
  return WhereMatcher.matches(target, where);
}

describe('WhereMatcher', () => {
  describe('plain conditions', () => {
    it('should match everything without conditions', () => {
      expect(WhereMatcher.matches(row, undefined)).toBe(true);
      expect(matches({})).toBe(true);
      expect(matches([])).toBe(true);
    });

    it('should match equal values on every key', () => {
      expect(matches({ id: '1', name: 'Alice' })).toBe(true);
      expect(matches({ id: '1', name: 'Bob' })).toBe(false);
    });

    it('should compare dates by time', () => {
      expect(matches({ at: new Date('2026-01-15T00:00:00Z') })).toBe(true);
      expect(matches({ at: new Date('2026-01-16T00:00:00Z') })).toBe(false);
    });

    it('should match an array of conditions as OR', () => {
      expect(matches([{ name: 'Bob' }, { age: 30 }])).toBe(true);
      expect(matches([{ name: 'Bob' }, { age: 31 }])).toBe(false);
    });
  });

  describe('operators', () => {
    it('IsNull', () => {
      expect(matches({ name: IsNull() }, empty)).toBe(true);
      expect(matches({ at: IsNull() }, empty)).toBe(true);
      expect(matches({ name: IsNull() })).toBe(false);
    });

    it('Not', () => {
      expect(matches({ name: Not('Bob') })).toBe(true);
      expect(matches({ name: Not('Alice') })).toBe(false);
      expect(matches({ name: Not('Bob') }, empty)).toBe(false);
    });

    it('Not(IsNull())', () => {
      expect(matches({ name: Not(IsNull()) })).toBe(true);
      expect(matches({ name: Not(IsNull()) }, empty)).toBe(false);
    });

    it('Not with another operator', () => {
      expect(matches({ age: Not(In([1, 2])) })).toBe(true);
      expect(matches({ age: Not(In([30])) })).toBe(false);
      expect(matches({ age: Not(MoreThan(40)) })).toBe(true);
    });

    it('Equal', () => {
      expect(matches({ name: Equal('Alice') })).toBe(true);
      expect(matches({ name: Equal('Bob') })).toBe(false);
      expect(matches({ at: Equal(new Date('2026-01-15T00:00:00Z')) })).toBe(true);
    });

    it('In', () => {
      expect(matches({ id: In(['1', '3']) })).toBe(true);
      expect(matches({ id: In(['2', '3']) })).toBe(false);
      expect(matches({ id: In([]) })).toBe(false);
      expect(matches({ name: In([null as unknown as string]) }, empty)).toBe(false);
    });

    it('Any', () => {
      expect(matches({ age: Any([29, 30]) })).toBe(true);
      expect(matches({ age: Any([31]) })).toBe(false);
    });

    it('LessThan', () => {
      expect(matches({ age: LessThan(31) })).toBe(true);
      expect(matches({ age: LessThan(30) })).toBe(false);
      expect(matches({ age: LessThan(100) }, empty)).toBe(false);
      expect(matches({ at: LessThan(new Date('2026-02-01T00:00:00Z')) })).toBe(true);
    });

    it('LessThanOrEqual', () => {
      expect(matches({ age: LessThanOrEqual(30) })).toBe(true);
      expect(matches({ age: LessThanOrEqual(29) })).toBe(false);
      expect(matches({ age: LessThanOrEqual(100) }, empty)).toBe(false);
    });

    it('MoreThan', () => {
      expect(matches({ age: MoreThan(29) })).toBe(true);
      expect(matches({ age: MoreThan(30) })).toBe(false);
      expect(matches({ age: MoreThan(0) }, empty)).toBe(false);
      expect(matches({ name: MoreThan('Aaron') })).toBe(true);
    });

    it('MoreThanOrEqual', () => {
      expect(matches({ age: MoreThanOrEqual(30) })).toBe(true);
      expect(matches({ age: MoreThanOrEqual(31) })).toBe(false);
      expect(matches({ age: MoreThanOrEqual(0) }, empty)).toBe(false);
    });

    it('Between (inclusive)', () => {
      expect(matches({ age: Between(30, 40) })).toBe(true);
      expect(matches({ age: Between(20, 30) })).toBe(true);
      expect(matches({ age: Between(31, 40) })).toBe(false);
      expect(matches({ age: Between(0, 100) }, empty)).toBe(false);
      expect(matches({ at: Between(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z')) })).toBe(true);
    });

    it('Like (case-sensitive)', () => {
      expect(matches({ name: Like('Al%') })).toBe(true);
      expect(matches({ name: Like('%ice') })).toBe(true);
      expect(matches({ name: Like('A_ice') })).toBe(true);
      expect(matches({ name: Like('Alice') })).toBe(true);
      expect(matches({ name: Like('al%') })).toBe(false);
      expect(matches({ name: Like('A_ce') })).toBe(false);
      expect(matches({ name: Like('%') }, empty)).toBe(false);
    });

    it('Like with escapes and regex characters', () => {
      const special: Row = { id: '3', name: '50%_off (a.b)\\' };

      expect(matches({ name: Like('50\\%\\_off%') }, special)).toBe(true);
      expect(matches({ name: Like('50\\%x%') }, special)).toBe(false);
      expect(matches({ name: Like('%(a.b)\\\\') }, special)).toBe(true);
      expect(matches({ name: Like('%(a_b)%') }, special)).toBe(true);
      expect(matches({ name: Like('%(a.c)%') }, special)).toBe(false);
    });

    it('ILike (case-insensitive)', () => {
      expect(matches({ name: ILike('al%') })).toBe(true);
      expect(matches({ name: ILike('%ICE') })).toBe(true);
      expect(matches({ name: ILike('bob') })).toBe(false);
    });

    it('And', () => {
      expect(matches({ age: And(MoreThan(20), LessThan(40)) })).toBe(true);
      expect(matches({ age: And(MoreThan(20), LessThan(30)) })).toBe(false);
    });

    it('Or', () => {
      expect(matches({ name: Or(Equal('Bob'), Like('Ali%')) })).toBe(true);
      expect(matches({ name: Or(Equal('Bob'), IsNull()) })).toBe(false);
      expect(matches({ name: Or(Equal('Bob'), IsNull()) }, empty)).toBe(true);
    });
  });

  describe('unsupported conditions', () => {
    it.each([
      ['Raw', { name: Raw(alias => `${alias} = 'Alice'`) }, 'MemoryRepository does not support the raw operator (where.name)'],
      ['ArrayContains', { name: ArrayContains(['a']) }, 'MemoryRepository does not support the arrayContains operator (where.name)'],
      ['JsonContains', { name: JsonContains({ a: 1 }) }, 'MemoryRepository does not support the jsonContains operator (where.name)'],
      ['a nested condition', { name: { first: 'Alice' } }, 'MemoryRepository does not support nested where conditions (where.name)'],
      ['null', { name: null }, 'where.name is null: use IsNull() to match empty columns'],
      ['undefined', { name: undefined }, 'where.name is undefined: use IsNull() to match empty columns'],
    ])('should throw for %s', (_, where, message) => {
      expect(() => matches(where as unknown as FindOptionsWhere<Row>)).toThrow(new UnsupportedQueryError(message));
    });

    it('should throw for unsupported operators nested in Not, And and Or', () => {
      expect(() => matches({ name: Not(Raw('x')) })).toThrow(UnsupportedQueryError);
      expect(() => matches({ name: Or(Equal('Bob'), Raw('x')) })).toThrow(UnsupportedQueryError);
    });
  });
});
