import { ExecutorContext } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import executor from './executor';
import { initialFiles } from './initial-files';
import { parseSize } from './size';

describe('GzipBudget Executor', () => {
  let root: string;
  let dir: string;
  const context = () => ({ root, cwd: root, isVerbose: false }) as ExecutorContext;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gzip-budget-'));
    dir = join(root, 'dist');
    mkdirSync(dir);
    writeFileSync(join(dir, 'index.html'), `<html><head>
      <link rel="stylesheet" href="styles-ABC.css">
      <link rel="modulepreload" href="chunk-1.js">
      <script src="https://cdn.example.com/x.js"></script>
    </head><body><script src="main-DEF.js" type="module"></script></body></html>`);
    writeFileSync(join(dir, 'styles-ABC.css'), 'body{margin:0}');
    writeFileSync(join(dir, 'chunk-1.js'), 'x'.repeat(10_000));
    writeFileSync(join(dir, 'main-DEF.js'), Array.from({ length: 5000 }, (_, i) => `v${i * 7919 % 10007}`).join(';'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('passes under the budget', async () => {
    const output = await executor({ outputPath: relative(root, dir), maximumError: '250kB' }, context());
    expect(output.success).toBe(true);
  });

  it('fails over the budget', async () => {
    const output = await executor({ outputPath: 'dist', maximumError: '1kB' }, context());
    expect(output.success).toBe(false);
  });

  it('only warns between the warning and the error budget', async () => {
    const output = await executor({ outputPath: 'dist', maximumWarning: '1kB', maximumError: '250kB' }, context());
    expect(output.success).toBe(true);
  });
});

describe('initialFiles', () => {
  it('lists local scripts, stylesheets and modulepreloads once, in order', () => {
    const html = `<link rel="icon" href="favicon.svg"><link rel="stylesheet" href="./styles.css?v=1">
      <link rel="modulepreload" href="chunk.js"><script src="//cdn.example.com/a.js"></script>
      <script src="/main.mjs"></script><script src="chunk.js"></script>`;
    expect(initialFiles(html)).toEqual(['styles.css', 'chunk.js', 'main.mjs']);
  });
});

describe('parseSize', () => {
  it('reads Angular budget sizes', () => {
    expect(parseSize('250kB')).toBe(250_000);
    expect(parseSize('1.5MB')).toBe(1_500_000);
    expect(parseSize('800 b')).toBe(800);
    expect(() => parseSize('250KiB')).toThrow();
  });
});
