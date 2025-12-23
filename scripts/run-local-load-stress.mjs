import { execSync } from "node:child_process";

const dataset = process.env.DATASET ?? "stress";
const maxNodes = process.env.MAX_NODES ?? "1000";

// k6 runs in a container, so it must reach the host via host.docker.internal on macOS.
const baseUrlForK6 = process.env.BASE_URL ?? "http://host.docker.internal:3000";

// Prisma seed runs on the host, connecting to Postgres via the port mapping.
const databaseUrlForSeed =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/interview_api?schema=public";

function run(cmd, env = {}) {
  execSync(cmd, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function runQuiet(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // best-effort
  }
}

async function waitForHealth(timeoutMs = 90_000) {
  const url = "http://localhost:3000/api/health";
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < timeoutMs) {
    attempts += 1;
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until ready
    }
    console.log(`Still waiting for /api/health... (${attempts})`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

let exitCode = 0;

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  runQuiet("docker compose down -v");
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  runQuiet("docker compose down -v");

  run("docker compose up -d --build db migrate api");

  console.log("Waiting for API readiness: http://localhost:3000/api/health");
  await waitForHealth();

  console.log(`Seeding trees via Prisma (DATASET=${dataset})`);
  run("npm run seed:trees", {
    DATASET: dataset,
    MAX_NODES: maxNodes,
    DATABASE_URL: databaseUrlForSeed,
  });

  console.log("Running k6 baseline GET /api/tree");
  run("npm run load:tree", {
    BASE_URL: baseUrlForK6,
  });
} catch (err) {
  exitCode = 1;
  console.error("\nLoad test failed. Dumping docker compose status/logs...\n");
  runQuiet("docker compose ps");
  runQuiet("docker compose logs --no-color db migrate api");
  console.error(err instanceof Error ? err.message : String(err));
} finally {
  cleanup();
  process.exit(exitCode);
}
