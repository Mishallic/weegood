import { defineConfig } from 'vitest/config';

// One Vitest run for the whole monorepo. Each workspace keeps its own config so it can also be
// run on its own (`npm test -w @weegood/core`).
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'apps/*/vite.config.ts'],
  },
});
