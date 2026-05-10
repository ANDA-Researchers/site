import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
    testTimeout: 10000,
    setupFiles: ['./tests/setup.js'],
  },
});
