import { defineConfig } from 'vitest/config';

// Unit tests target the pure logic layer (demo fixtures/handlers, utils) — no DOM rendering —
// so they run in the fast node environment with a tiny Storage stub instead of jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts']
  }
});
