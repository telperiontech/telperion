/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import * as path from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const __dirname = import.meta.dirname;

/**
 * Specs of the entry points, rendered through TestBed with the Angular compiler
 */
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ng-ui',
  plugins: [angular({ tsconfig: path.join(__dirname, 'tsconfig.spec.json') }), nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.tmp/**', 'src/**'],
    setupFiles: ['test-setup.ts'],
    // Load every Angular package through vite-node: Vitest inlines the `@angular/*/testing` bundles, and
    // a natively loaded `@angular/core` next to them would be a second copy (NG0401: No platform exists)
    server: { deps: { inline: [/[\/]@angular[\/]/] } },
    reporters: ['default'],
    coverage: {
      clean: true,
      reportsDirectory: path.join(__dirname, '../../coverage/libs/ng-ui'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['**/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.spec.ts', '**/*.stories.ts', '.tmp/**', 'src/**'],
    },
  },
}));
