/// <reference types='vitest' />
import { defineConfig } from 'vite';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

/**
 * Specs that need a real browser (`*.browser.spec.ts`): form-associated custom elements,
 * constructable stylesheets and native form submission, which jsdom does not implement.
 */
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/elements-browser',
  plugins: [nxViteTsPaths()],
  test: {
    watch: false,
    globals: true,
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: process.env['HEADLESS'] !== 'false',
      // This repo's dev-port block (AGENTS.md), not Vite's default 5173
      api: 10570,
    },
    include: ['src/**/*.browser.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: path.join(__dirname, '../../coverage/libs/elements-browser'),
      provider: 'istanbul',
    },
  },
}));
