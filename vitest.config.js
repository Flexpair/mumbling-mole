import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    exclude: [
      'node_modules/**/*',
      'vendors/**/*',
      'dist/**/*',
    ],
  },
  resolve: {
    alias: {
      // Mock audio-related modules for testing
      'audio-context': './test/mocks/audio-context.js',
    },
  },
});