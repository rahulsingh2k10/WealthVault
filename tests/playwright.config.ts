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
      NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS: "300",
    },
  },
});
