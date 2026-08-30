import { defineConfig } from "@playwright/test";
import { loadFrontendEnv } from "./helpers/loadEnv";

loadFrontendEnv();

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    cwd: "../frontend",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      PAYMENTS_PROVIDER: "fake",
      RAZORPAY_KEY_SECRET: "test_key_secret_123",
      RAZORPAY_KEY_ID: "rzp_test_e2e",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_e2e",
      // RAZORPAY_WEBHOOK_SECRET falls back to the fixed test value in webhookSecret.ts
    },
  },
});
