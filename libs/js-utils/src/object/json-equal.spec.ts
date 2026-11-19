import { jsonEqual } from './json-equal';

describe('jsonEqual', () => {
  it.each([
    [1, 1],
    ['a', 'a'],
    [null, null],
    [[1, [2, 3]], [1, [2, 3]]],
    [{ a: 1, b: { c: [1] } }, { b: { c: [1] }, a: 1 }],
  ])('%j equals %j', (a, b) => expect(jsonEqual(a, b)).toBe(true));

  it.each([
    [1, '1'],
    [null, {}],
    [[1, 2], [2, 1]],
    [[1], { 0: 1 }],
    [{ a: 1 }, { a: 1, b: 2 }],
    [{ a: 1, b: 2 }, { a: 1, c: 2 }],
  ])('%j differs from %j', (a, b) => expect(jsonEqual(a, b)).toBe(false));
});
