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
      // RAZORPAY_KEY_SECRET / RAZORPAY_KEY_ID / NEXT_PUBLIC_RAZORPAY_KEY_ID /
      // RAZORPAY_WEBHOOK_SECRET are deliberately NOT overridden here — the dev
      // server (whether spawned fresh by Playwright or reused from the jest
      // testServer via reuseExistingServer) reads them from frontend/.env, and
      // subscription.spec.ts reads the same values via loadFrontendEnv(), so the
      // in-page stub signatures match FakeProvider's server-side verification.
    },
  },
});
