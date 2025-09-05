import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/unit/setup.js'],
    environment: 'node',
    include: ['tests/unit/**/*.spec.js']
  }
});
