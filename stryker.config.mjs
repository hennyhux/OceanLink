// Mutation testing for the UX rules: money, payments, the Overview dashboard, and search.
// Run with `npm run test:mutation`. The HTML report lands in reports/mutation/index.html.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts' },
  // Pure rule modules only. Components are tested through the screen tests instead.
  mutate: [
    'src/features/overview/model.ts',
    'src/features/overview/cardState.ts',
    'src/features/overview/searchModel.ts',
    'src/features/payments/model.ts',
    'src/lib/money.ts',
    'src/lib/dates.ts',
  ],
  // Rules live inside functions (see payments/model.ts), so there are no static mutants to skip.
  ignoreStatic: true,
  // The rule modules start at 100%. Falling below 90 fails the run so regressions are caught.
  thresholds: { high: 95, low: 90, break: 90 },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
