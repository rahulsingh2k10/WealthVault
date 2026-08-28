/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/api/**/*.test.ts", "<rootDir>/database/**/*.test.ts"],
  testTimeout: 30000,
};
