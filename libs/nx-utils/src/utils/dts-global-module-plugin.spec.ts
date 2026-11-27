import { DtsGlobalModule, dtsGlobalModule } from './dts-global-module-plugin';

const AUGMENTATION_ONLY = [
  'declare global {',
  '    export interface Array<T> {',
  '        asyncMap<U>(fn: (value: T) => Promise<U>): Promise<U[]>;',
  '    }',
  '}',
  '',
].join('\n');
const WITH_IMPORT = [
  "import { TryCatchResult } from '../try-catch.js';",
  '',
  'declare global {',
  '    export interface Promise<T> {',
  '        tryCatch(): Promise<TryCatchResult<T>>;',
  '    }',
  '}',
  '',
].join('\n');
const WITH_EXPORT = ['declare function foo(): void;', '', 'export { foo };', ''].join('\n');

describe('dtsGlobalModule', () => {
  it('should mark a global augmentation without module syntax, ignoring exports inside the global block', () => {
    expect(DtsGlobalModule.needsMarker(AUGMENTATION_ONLY)).toBe(true);
  });

  it('should leave files with a top-level import or export alone', () => {
    expect(DtsGlobalModule.needsMarker(WITH_IMPORT)).toBe(false);
    expect(DtsGlobalModule.needsMarker(WITH_EXPORT)).toBe(false);
  });

  it('should append export {} in renderChunk', () => {
    const renderChunk = dtsGlobalModule().renderChunk as (code: string) => { code: string } | null;

    expect(renderChunk(AUGMENTATION_ONLY)?.code).toBe(`${AUGMENTATION_ONLY.trimEnd()}\n\nexport {};\n`);
    expect(renderChunk(WITH_IMPORT)).toBeNull();
  });
});
