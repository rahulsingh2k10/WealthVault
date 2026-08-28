/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/api/**/*.test.ts", "<rootDir>/database/**/*.test.ts"],
  testTimeout: 30000,
  // Frontend source files imported directly by tests (e.g. SubscriptionPeriodService.ts)
  // use the "@/*" path alias — resolve it the same way frontend/tsconfig.json does.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../frontend/src/$1",
  },
};
