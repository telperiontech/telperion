import type { FindOptionsOrder } from 'typeorm';

import { FindOrder } from './find-order';
import { UnsupportedQueryError } from './unsupported-query-error';

interface Row {
  id: string;
  group: string;
  score: number | null;
  at: Date;
}

const rows: Row[] = [
  { id: 'a', group: 'x', score: 2, at: new Date('2026-01-03') },
  { id: 'b', group: 'y', score: null, at: new Date('2026-01-01') },
  { id: 'c', group: 'x', score: 1, at: new Date('2026-01-02') },
  { id: 'd', group: 'y', score: 3, at: new Date('2026-01-04') },
];

function ids(order?: FindOptionsOrder<Row>): string[] {
  return FindOrder.sort(rows, order).map(({ id }) => id);
}

describe('FindOrder', () => {
  it('should keep the order without an order option', () => {
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(ids({})).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should not change the given array', () => {
    FindOrder.sort(rows, { id: 'DESC' });

    expect(rows.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it.each(['ASC', 'asc', 1] as const)('should sort ascending with %p', direction => {
    expect(ids({ at: direction })).toEqual(['b', 'c', 'a', 'd']);
  });

  it.each(['DESC', 'desc', -1] as const)('should sort descending with %p', direction => {
    expect(ids({ at: direction })).toEqual(['d', 'a', 'c', 'b']);
  });

  it('should accept { direction }', () => {
    expect(ids({ at: { direction: 'desc' } })).toEqual(['d', 'a', 'c', 'b']);
  });

  it('should sort by several keys in order', () => {
    expect(ids({ group: 'ASC', at: 'DESC' })).toEqual(['a', 'c', 'd', 'b']);
    expect(ids({ group: 'DESC', id: 'ASC' })).toEqual(['b', 'd', 'a', 'c']);
  });

  it('should put nulls last ascending and first descending by default', () => {
    expect(ids({ score: 'ASC' })).toEqual(['c', 'a', 'd', 'b']);
    expect(ids({ score: 'DESC' })).toEqual(['b', 'd', 'a', 'c']);
  });

  it('should follow the nulls option', () => {
    expect(ids({ score: { direction: 'ASC', nulls: 'FIRST' } })).toEqual(['b', 'c', 'a', 'd']);
    expect(ids({ score: { direction: 'DESC', nulls: 'last' } })).toEqual(['d', 'a', 'c', 'b']);
  });

  it('should throw for ordering by relations', () => {
    expect(() => FindOrder.sort(rows, { group: { name: 'ASC' } } as unknown as FindOptionsOrder<Row>)).toThrow(
      new UnsupportedQueryError('MemoryRepository does not support ordering by relations (order.group)'),
    );
  });
});
