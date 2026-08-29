import { spawnSync } from "child_process";
import { stopDevServerIfOwned } from "./helpers/testServer";

type Suite = "auth" | "unlock" | "dashboard" | "database" | "playwright";
const ALL_SUITES: Suite[] = ["auth", "unlock", "dashboard", "database", "playwright"];

function runJest(testPathPattern: string): number {
  const result = spawnSync(
    "npx",
    ["jest", "--config", "jest.config.js", "--runInBand", testPathPattern],
    { cwd: __dirname, stdio: "inherit" }
  );
  return result.status ?? 1;
}

function runPlaywright(): number {
  const result = spawnSync("npx", ["playwright", "test", "--config", "playwright.config.ts"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function runSuite(suite: Suite): number {
  console.log(`\n=== Running ${suite} suite ===\n`);
  switch (suite) {
    case "auth":
      return runJest("api/auth");
    case "unlock":
      return runJest("api/unlock");
    case "dashboard":
      return runJest("api/dashboard");
    case "database":
      return runJest("database");
    case "playwright":
      return runPlaywright();
  }
}

async function main() {
  const arg = process.argv[2];
  let suites: Suite[];

  if (!arg) {
    suites = ALL_SUITES;
  } else if ((ALL_SUITES as string[]).includes(arg)) {
    suites = [arg as Suite];
  } else {
    console.error(`Unknown suite "${arg}". Valid suites: ${ALL_SUITES.join(", ")}`);
    process.exit(1);
  }

  let exitCode = 0;
  try {
    for (const suite of suites) {
      const code = runSuite(suite);
      if (code !== 0) exitCode = code;
    }
  } finally {
    await stopDevServerIfOwned();
  }

  process.exit(exitCode);
}

main();
