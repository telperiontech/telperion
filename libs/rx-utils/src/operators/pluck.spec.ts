import { from, lastValueFrom, Observable, of, toArray } from 'rxjs';
import { pluck } from './pluck';

/** Compile-time check: `true` only when `A` and `B` are the same type */
type Equals<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;

function expectType<T>(_value: Observable<T>) {
  return { toBe: <E>(_check: Equals<T, E>) => undefined };
}

interface State {
  user: { name: { first: string; last: string }; tags: string[] };
  team?: { lead: { name: string } | null };
  id: number;
}

const state: State = {
  user: { name: { first: 'Ada', last: 'Lovelace' }, tags: ['math', 'code'] },
  team: { lead: null },
  id: 1,
};

describe('pluck', () => {
  it('emits one property of each value', async () => {
    const id$ = of(state).pipe(pluck('id'));

    expectType(id$).toBe<number>(true);
    await expect(lastValueFrom(id$)).resolves.toBe(1);
  });

  it('follows nested keys', async () => {
    const first$ = of(state).pipe(pluck('user', 'name', 'first'));

    expectType(first$).toBe<string>(true);
    await expect(lastValueFrom(first$)).resolves.toBe('Ada');
  });

  it('indexes into arrays', async () => {
    const tag$ = of(state).pipe(pluck('user', 'tags', 1));

    expectType(tag$).toBe<string>(true);
    await expect(lastValueFrom(tag$)).resolves.toBe('code');
  });

  it('emits undefined past a null or undefined link, and types it so', async () => {
    const states: State[] = [state, { ...state, team: undefined }];
    const lead$ = from(states).pipe(pluck('team', 'lead', 'name'), toArray());

    expectType(lead$).toBe<(string | undefined)[]>(true);
    await expect(lastValueFrom(lead$)).resolves.toEqual([undefined, undefined]);
  });

  it('keeps null when the last key holds it', async () => {
    const lead$ = of(state).pipe(pluck('team', 'lead'));

    expectType(lead$).toBe<{ name: string } | null | undefined>(true);
    await expect(lastValueFrom(lead$)).resolves.toBeNull();
  });

  it('follows up to six keys', async () => {
    const deep = { a: { b: { c: { d: { e: { f: 'end' } } } } } };
    const end$ = of(deep).pipe(pluck('a', 'b', 'c', 'd', 'e', 'f'));

    expectType(end$).toBe<string>(true);
    await expect(lastValueFrom(end$)).resolves.toBe('end');
  });

  it('rejects keys the value does not have', () => {
    // @ts-expect-error `nickname` is not a key of `user.name`
    of(state).pipe(pluck('user', 'name', 'nickname'));
    // @ts-expect-error `missing` is not a key of `State`
    of(state).pipe(pluck('missing'));
  });
});
