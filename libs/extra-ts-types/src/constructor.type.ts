/**
 * ### ConstructorType
 *
 * The bare construct signature of a class or constructor type
 *
 * Keeps only `new (...args) => instance` and drops static members, the `prototype` property and
 * extra overloads (the last construct signature wins). Useful for passing a class around as a
 * factory, or for reading its constructor parameters through `ConstructorParameters`. Abstract
 * classes stay abstract; types that are not constructible resolve to `never`.
 *
 * * * *
 * Example usage:
 * ```typescript
 * import type { ConstructorType } from "@telperion/extra-ts-types";
 *
 * class User {
 *   static table = "users";
 *   constructor(public name: string, public age?: number) {}
 * }
 *
 * type UserFactory = ConstructorType<typeof User>;
 * // new (name: string, age?: number) => User
 *
 * type Executor = ConstructorParameters<ConstructorType<PromiseConstructor>>[0];
 * // (resolve: (value: unknown) => void, reject: (reason?: any) => void) => void
 *
 * abstract class Shape { constructor(public sides: number) {} }
 *
 * type ShapeType = ConstructorType<typeof Shape>;
 * // abstract new (sides: number) => Shape
 * ```
 * * * *
 * @template T Class or constructor type, e.g. `typeof User`
 */
export type ConstructorType<T> = T extends new (...args: infer P) => infer R
  ? new (...args: P) => R
  : T extends abstract new (...args: infer P) => infer R
    ? abstract new (...args: P) => R
    : never;
