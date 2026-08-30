import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import { loadFrontendEnv } from "./loadEnv";

loadFrontendEnv();

export const TEST_SERVER_PORT = 3100;
export const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}`;

const FRONTEND_DIR = join(__dirname, "..", "..", "frontend");

let ownedProcess: ChildProcess | undefined;

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(TEST_SERVER_URL);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Test server did not come up on port ${TEST_SERVER_PORT} within ${timeoutMs}ms`);
}

// Points the app under test at TEST_DATABASE_URL (never the app's real
// DATABASE_URL) — this suite must never run its HTTP checks against production.
export async function ensureDevServer(): Promise<void> {
  if (await isUp()) return;

  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not set in frontend/.env — required to run this suite.");
  }

  ownedProcess = spawn(
    "npx",
    ["next", "dev", "-p", String(TEST_SERVER_PORT)],
    {
      cwd: FRONTEND_DIR,
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, PAYMENTS_PROVIDER: "fake" },
      stdio: "ignore",
      detached: true, // own process group, so the whole npx->next->next-server tree can be killed together
    }
  );
  // Don't let this child process keep the test runner's event loop alive —
  // otherwise Jest/ts-node never exits once this suite has started the server.
  ownedProcess.unref();

  await waitForServer(60000);
}

export async function stopDevServerIfOwned(): Promise<void> {
  if (ownedProcess && !ownedProcess.killed && ownedProcess.pid) {
    try {
      process.kill(-ownedProcess.pid, "SIGTERM");
    } catch {
      ownedProcess.kill();
    }
    ownedProcess = undefined;
  }
}
