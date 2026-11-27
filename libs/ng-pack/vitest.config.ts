/// <reference types='vitest' />
import { defineConfig } from 'vite';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

/**
 * Unit tests of the secondary entry points that run without the Angular compiler
 * (plain functions and classes, with stub injectors instead of TestBed)
 */
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ng-pack',
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['*/src/**/*.spec.ts'],
    // TestBed specs run through vitest.testbed.config.ts
    exclude: ['**/node_modules/**', '**/dist/**', '.tmp/**', 'src/**', '**/*.testbed.spec.ts'],
    setupFiles: ['test-setup.ts'],
    reporters: ['default'],
    coverage: {
      clean: true,
      reportsDirectory: path.join(__dirname, '../../coverage/libs/ng-pack'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.spec.ts', '**/*.stories.ts', '.tmp/**', 'src/**'],
    },
  },
}));
