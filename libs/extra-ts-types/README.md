# @telperion/extra-ts-types

[![npm version](https://badge.fury.io/js/@telperion%2Fextra-ts-types.svg)](https://badge.fury.io/js/@telperion%2Fextra-ts-types)

Extra TypeScript utility types for advanced type manipulation and better type safety. Types only: nothing ends up in your bundle.

**Documentation:** [open-source.telperion.tr/extra-ts-types](https://open-source.telperion.tr/extra-ts-types)

## Installation

```bash
npm install @telperion/extra-ts-types
```

```bash
yarn add @telperion/extra-ts-types
```

```bash
pnpm add @telperion/extra-ts-types
```

## Usage

Import types with `import type`, from the package root or from each type's own path:

```typescript
import type { AnyFunction, PartialSome, Join, Tail } from '@telperion/extra-ts-types';
import type { DeepestObject } from '@telperion/extra-ts-types/deepest.type';
```

Polyfills declare globals, so import them once for their side effect:

```typescript
import '@telperion/extra-ts-types/polyfills';
```

## API

### `AnyFunction`

Any function: any parameters, any return type. A constraint for code that stores, wraps or forwards functions without caring about their signature.

```typescript
function once<F extends AnyFunction>(fn: F): F { /* ... */ }

const init = once((id: number) => `ready ${id}`); // (id: number) => string
```

### `ConstructorType<T>`

The bare construct signature of a class or constructor type: drops static members and `prototype`. Abstract classes stay abstract.

```typescript
class User {
  static table = 'users';
  constructor(public name: string, public age?: number) {}
}

type UserFactory = ConstructorType<typeof User>;
// new (name: string, age?: number) => User

type Executor = ConstructorParameters<ConstructorType<PromiseConstructor>>[0];
// (resolve: (value: unknown) => void, reject: (reason?: any) => void) => void
```

### `DeepestValue<T, K>`

The value at the end of a chain of objects linked by the same key. Nullable links branch into every place the chain can end, and cycles are handled.

```typescript
type Response = { data: { data: { data: string } } };

type Payload = DeepestValue<Response, 'data'>;
// string

type ListNode = { value: number; next: ListNode | null };

type End = DeepestValue<ListNode, 'next'>;
// null
```

### `DeepestObject<T, K>`

The last object in a chain of objects linked by the same key: one whose `K` is missing or not an object. This is the return type of `deepest` from `@telperion/js-utils`.

```typescript
type Wrapped = { data: { data: { value: string; other: number } } };

type Inner = DeepestObject<Wrapped, 'data'>;
// { value: string; other: number }

type Root = { parent: Folder };
type Folder = { name: string; parent: Drive };
type Drive = { name: string; parent: null };

type Top = DeepestObject<Root, 'parent'>;
// Drive
```

### `Join<T, Sep>`

Every ordered combination of a string union's members, joined with a separator (default `,`). The count grows factorially, so keep the union small (about 6 members at most).

```typescript
type Pair = Join<'x' | 'y'>;
// "x" | "y" | "x,y" | "y,x"

type Flags = Join<'a' | 'b' | 'c', '-'>;
// "a" | "b" | "c" | "a-b" | "a-c" | "b-a" | ... | "c-b-a"
```

### `PartialSome<T, K>`

An object type with only the given keys made optional.

```typescript
interface User {
  id: number;
  name: string;
  role: 'admin' | 'member';
}

type NewUser = PartialSome<User, 'id' | 'role'>;
// same shape as { name: string; id?: number; role?: 'admin' | 'member' }
```

### `PathValue<T, P>`

The type of the value reached by following a list of keys into an object, the way `obj?.a?.b` reads at runtime: a `null` or `undefined` link on the way adds `undefined` to the result. This is the result type of `pluck` from `@telperion/rx-utils`.

```typescript
type State = { user: { name: { first: string } }; team?: { lead: string } };

type First = PathValue<State, ['user', 'name', 'first']>;
// string

type Lead = PathValue<State, ['team', 'lead']>;
// string | undefined

type Item = PathValue<{ items: string[] }, ['items', number]>;
// string
```

### `Tail<X>`

A tuple or parameter list without its first element. The result is always mutable.

```typescript
type Rest = Tail<[1, 2, 3]>;
// [2, 3]

type Args = Tail<Parameters<(ctx: Context, id: number, body: string) => void>>;
// [id: number, body: string]
```

## Polyfills

### `URLPattern` (global)

Type declarations for the [URLPattern Web API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern), which TypeScript's DOM library does not ship yet. They declare types only: in runtimes without native support, also load a runtime polyfill such as `urlpattern-polyfill`.

```typescript
// Import all polyfills
import '@telperion/extra-ts-types/polyfills';

// Or URLPattern only
import '@telperion/extra-ts-types/polyfills/url-pattern';

// The interfaces, for annotations
import type { URLPattern } from '@telperion/extra-ts-types/polyfills/url-pattern';

const pattern: URLPattern = new URLPattern({ pathname: '/books/:id' });

pattern.test('https://example.com/books/123'); // true
pattern.exec('https://example.com/books/123')?.pathname.groups.id; // '123'
```

**Interfaces:**
- `URLPattern`: the pattern, with `test()` and `exec()`
- `URLPatternConstructor`: type of the global `URLPattern` constructor
- `URLPatternInit`: per-component patterns for creating a pattern
- `URLPatternResult`: match result with every URL component and its captured groups
- `URLPatternComponentResult`: matched text and groups of one URL component

## Contributing

This package is part of the [Telperion](https://github.com/telperiontech) monorepo. Contributions are welcome!

## License

MIT © [Telperion](https://github.com/telperiontech)
