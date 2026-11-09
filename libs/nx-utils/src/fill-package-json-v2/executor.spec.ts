import type { ExecutorContext } from '@nx/devkit';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import executor from './executor';

const REQUIRED_ORDER = ['types', 'import', 'require', 'node', 'default'];

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

describe('FillPackageJsonV2 Executor', () => {
  let root: string;
  let context: ExecutorContext;
  const outputPath = 'dist/lib';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fill-pkg-v2-'));
    await mkdir(join(root, 'libs/lib'), { recursive: true });
    await mkdir(join(root, outputPath), { recursive: true });
    await writeJson(join(root, 'package.json'), { name: 'root', license: 'MIT' });
    context = {
      root,
      cwd: root,
      isVerbose: false,
      projectName: 'lib',
      projectsConfigurations: { version: 2, projects: { lib: { root: 'libs/lib' } } },
    } as unknown as ExecutorContext;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  async function readOutput() {
    return JSON.parse(await readFile(join(root, outputPath, 'package.json'), 'utf-8'));
  }

  it('emits manifest-based exports in spec order', async () => {
    await writeJson(join(root, 'libs/lib/package.json'), { name: '@x/lib', type: 'module' });
    await writeJson(join(root, outputPath, '.build-manifest.json'), {
      schemaVersion: 1,
      name: 'lib',
      version: '0.0.0',
      formats: ['esm', 'cjs', 'dts', 'dcts'],
      generatedAt: '',
      entries: ['index', 'sub/thing'].map((name) => ({
        name,
        sourcePath: `src/${name}.ts`,
        outputs: { esm: `${name}.js`, cjs: `${name}.cjs`, dts: `${name}.d.ts`, dcts: `${name}.d.cts` },
      })),
    });

    const result = await executor({ outputPath, populateExports: {} }, context);
    expect(result.success).toBe(true);

    const { exports } = await readOutput();
    for (const entry of Object.values(exports)) {
      expect(Object.keys(entry as object)).toEqual(REQUIRED_ORDER);
    }
    expect(exports['.'].import).toBe('./index.js');
  });

  it('emits template-based exports in spec order even for alphabetical input', async () => {
    await writeJson(join(root, 'libs/lib/package.json'), { name: '@x/lib', _exports: ['a', 'b/'] });

    const result = await executor(
      {
        outputPath,
        populateExports: {
          source: 'exports',
          dcts: false,
          exports: ['default', 'import', 'node', 'require', 'types'],
        },
      },
      context,
    );
    expect(result.success).toBe(true);

    const { exports } = await readOutput();
    expect(Object.keys(exports)).toEqual(['.', './a', './b']);
    for (const entry of Object.values(exports)) {
      expect(Object.keys(entry as object)).toEqual(REQUIRED_ORDER);
    }
  });

  it('fails instead of writing a mis-ordered hand-written exports entry', async () => {
    await writeJson(join(root, 'libs/lib/package.json'), {
      name: '@x/lib',
      exports: { './extra': { default: './extra.cjs', types: './extra.d.ts' } },
    });

    const result = await executor({ outputPath, populateExports: false }, context);
    expect(result.success).toBe(false);
  });
});
