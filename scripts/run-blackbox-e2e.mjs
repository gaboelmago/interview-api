import { execSync } from "node:child_process";

const project =
  process.env.E2E_COMPOSE_PROJECT ??
  `interview-api-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}-${
    process.pid
  }`.toLocaleLowerCase();

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const compose = (args) =>
  `docker compose -p ${project} -f docker-compose.yml ${args}`;

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

function runQuiet(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // best-effort
  }
}

async function waitForHealth(timeoutMs = 90_000) {
  const url = `${baseUrl}/api/health`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until ready
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(`API did not become ready at ${url} within ${timeoutMs}ms`);
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;

  runQuiet(compose("down -v"));
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

let exitCode = 0;

try {
  // Ensure a fresh DB per run
  runQuiet(compose("down -v"));

  // Start production-like stack
  run(compose("up -d --build db migrate api"));

  // Show migration logs (useful even on success)
  runQuiet(compose("logs --no-color migrate"));

  console.log(`Waiting for API readiness: ${baseUrl}/api/health`);
  await waitForHealth();

  // Run black-box tests (HTTP-only)
  run("npm run e2e:blackbox:run", {
    env: {
      ...process.env,
      E2E_BASE_URL: baseUrl,
    },
  });
} catch (err) {
  exitCode = 1;

  console.error("\nE2E failed. Dumping docker compose status/logs...\n");
  runQuiet(compose("ps"));
  runQuiet(compose("logs --no-color db migrate api"));

  console.error(err instanceof Error ? err.message : String(err));
} finally {
  cleanup();
  process.exit(exitCode);
}
