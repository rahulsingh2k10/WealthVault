/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/api/**/*.test.ts", "<rootDir>/database/**/*.test.ts"],
  testTimeout: 30000,
  // "default" keeps the standard summary; listReporter prints each executed
  // test case with its pass/fail result (Jest 30 --verbose no longer does).
  reporters: ["default", "<rootDir>/helpers/listReporter.js"],
  // Frontend source files imported directly by tests (e.g. SubscriptionPlanHistoryService.ts)
  // use the "@/*" path alias — resolve it the same way frontend/tsconfig.json does.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../frontend/src/$1",
  },
};
