import { defineConfig } from 'vitest/config';

// Most unit tests target the pure logic layer (demo fixtures/handlers, utils) -- no DOM
// rendering -- so they run in the fast node environment with a tiny Storage stub instead of
// jsdom by default. Component/a11y tests that do need a real DOM (focus trap, dialog semantics)
// opt into jsdom per-file via a `// @vitest-environment jsdom` docblock at the top of the file.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
