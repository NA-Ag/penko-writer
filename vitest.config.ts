import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // the app bundles mammoth's browser build (reads { arrayBuffer }); use the same one in tests
      mammoth: path.resolve(__dirname, 'node_modules/mammoth/mammoth.browser.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    css: false,
  },
});
