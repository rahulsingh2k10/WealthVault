import { readFileSync, existsSync } from "fs";
import { join } from "path";

// The frontend app's own .env is the single source of truth for secrets that
// must match what the running server uses (DATABASE_URL, TEST_DATABASE_URL,
// SESSION_SECRET, ENCRYPTION_SALT). This suite has its own tooling but reads
// those values from there rather than duplicating them into a second file.
const FRONTEND_ENV_PATH = join(__dirname, "..", "..", "frontend", ".env");

function parseEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const contents = readFileSync(path, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export function loadFrontendEnv(): void {
  if (!existsSync(FRONTEND_ENV_PATH)) {
    throw new Error(`frontend/.env not found at ${FRONTEND_ENV_PATH}`);
  }
  const vars = parseEnvFile(FRONTEND_ENV_PATH);
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
