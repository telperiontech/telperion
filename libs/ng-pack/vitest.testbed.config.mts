/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import * as path from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const __dirname = import.meta.dirname;

/**
 * Specs that render templates through TestBed (`*.testbed.spec.ts`): directives that need the
 * Angular compiler and a DOM, unlike the plain unit specs of vitest.config.ts
 */
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ng-pack-testbed',
  plugins: [angular({ tsconfig: path.join(__dirname, 'tsconfig.spec.json') }), nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['*/src/**/*.testbed.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.tmp/**', 'src/**'],
    setupFiles: ['test-setup.testbed.ts'],
    // Load every Angular package through vite-node: Vitest inlines the `@angular/*/testing` bundles, and
    // a natively loaded `@angular/core` next to them would be a second copy (NG0401: No platform exists)
    server: { deps: { inline: [/[\/]@angular[\/]/] } },
    reporters: ['default'],
    coverage: {
      clean: true,
      reportsDirectory: path.join(__dirname, '../../coverage/libs/ng-pack-testbed'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.spec.ts', '**/*.stories.ts', '.tmp/**', 'src/**'],
    },
  },
}));
