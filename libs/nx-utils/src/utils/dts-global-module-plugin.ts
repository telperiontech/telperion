import type { Plugin } from 'rollup';

/**
 * Keeps declaration files that augment `global` as modules.
 *
 * A source file like `array/proto/async-map.ts` imports its base function only as a value, so
 * `rollup-plugin-dts` drops the import and the emitted `.d.ts` holds just `declare global { … }`.
 * Without an `import`/`export`, TypeScript reads that file as a script, where a global augmentation
 * is not allowed, and consumers silently lose the augmented types (`array.asyncMap` "does not exist").
 * Appending `export {};` turns the file back into a module.
 */
export function dtsGlobalModule(): Plugin {
  return {
    name: 'dts-global-module',
    renderChunk(code) {
      return DtsGlobalModule.needsMarker(code) ? { code: `${code.trimEnd()}\n\nexport {};\n`, map: null } : null;
    },
  };
}

/**
 * Detection of global-augmenting declaration files without module syntax
 */
export class DtsGlobalModule {
  // Top level only: `export interface` inside the `declare global` block does not make the file a module
  static readonly #GLOBAL_AUGMENTATION = /^declare global\b/m;
  static readonly #MODULE_SYNTAX = /^(import|export)\b/m;

  /**
   * `true` when the declaration code augments `global` but has no top-level `import` or `export`
   */
  static needsMarker(code: string): boolean {
    return DtsGlobalModule.#GLOBAL_AUGMENTATION.test(code) && !DtsGlobalModule.#MODULE_SYNTAX.test(code);
  }
}
