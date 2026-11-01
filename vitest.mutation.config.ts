import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// Mutation testing runs only the fast, pure unit layer (*.test.ts). Screen tests (*.test.tsx)
// are too slow to run once per mutant and are covered by the normal `npm test` run.
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      include: ['src/**/*.test.ts'],
    },
  }),
);
