import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TESTS = {
  1: {
    id: "test1",
    configFile: "load/k6/config/test1-baseline-small.json",
    scriptFile: "load/k6/tests/test1-baseline-small.js",
  },
  2: {
    id: "test2",
    configFile: "load/k6/config/test2-concurrency-small.json",
    scriptFile: "load/k6/tests/test2-concurrency-small.js",
  },
  3: {
    id: "test3",
    configFile: "load/k6/config/test3-deep-traversal.json",
    scriptFile: "load/k6/tests/test3-deep-traversal.js",
  },
  4: {
    id: "test4",
    configFile: "load/k6/config/test4-wide-serialization.json",
    scriptFile: "load/k6/tests/test4-wide-serialization.js",
  },
  5: {
    id: "test5",
    configFile: "load/k6/config/test5-endurance.json",
    scriptFile: "load/k6/tests/test5-endurance.js",
  },
  6: {
    id: "test6",
    configFile: "load/k6/config/test6-breaking-point.json",
    scriptFile: "load/k6/tests/test6-breaking-point.js",
  },
  W1: {
    id: "testW1",
    configFile: "load/k6/config/testW1-baseline-single-writer.json",
    scriptFile: "load/k6/tests/testW1-baseline-single-writer.js",
  },
  W2: {
    id: "testW2",
    configFile: "load/k6/config/testW2-low-concurrency.json",
    scriptFile: "load/k6/tests/testW2-low-concurrency.js",
  },
  W3: {
    id: "testW3",
    configFile: "load/k6/config/testW3-hotspot-parent.json",
    scriptFile: "load/k6/tests/testW3-hotspot-parent.js",
  },
  W4: {
    id: "testW4",
    configFile: "load/k6/config/testW4-distributed-writes.json",
    scriptFile: "load/k6/tests/testW4-distributed-writes.js",
  },
  W5: {
    id: "testW5",
    configFile: "load/k6/config/testW5-endurance.json",
    scriptFile: "load/k6/tests/testW5-endurance.js",
  },
  W6: {
    id: "testW6",
    configFile: "load/k6/config/testW6-breaking-point.json",
    scriptFile: "load/k6/tests/testW6-breaking-point.js",
  },
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const [flag, inlineValue] = token.split("=", 2);
    if (inlineValue != null) {
      args[flag] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[flag] = next;
      i++;
    } else {
      args[flag] = true;
    }
  }
  return args;
}

function runShell(cmd, env = {}) {
  execSync(cmd, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function runShellQuiet(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // best-effort
  }
}

function runCmd(cmd, args, env = {}) {
  execFileSync(cmd, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
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

function scenarioLabel(scenario) {
  if (!scenario?.executor) return "unknown";
  if (scenario.executor === "constant-vus") {
    return `${scenario.vus ?? "?"}vus-${scenario.duration ?? "?"}`;
  }
  if (scenario.executor === "constant-arrival-rate") {
    return `${scenario.rate ?? "?"}rps-${scenario.duration ?? "?"}`;
  }
  return scenario.executor;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const asString = String(value);
    if (asString.trim().length === 0) continue;
    return asString;
  }
  return undefined;
}

const args = parseArgs(process.argv.slice(2));
const testNumRaw = args["--test"] ?? process.env.TEST;
if (!testNumRaw) {
  console.error(
    "Missing --test <1..6|W1..W6>. Example: node scripts/run-load-test.mjs --test 1"
  );
  process.exit(2);
}

const testKey = String(testNumRaw).trim().toUpperCase();
const testDef = TESTS[testKey];
if (!testDef) {
  console.error(`Unknown test: ${testKey}. Valid: 1..6, W1..W6`);
  process.exit(2);
}

const repoRoot = process.cwd();
const configPathOnHost = path.resolve(repoRoot, testDef.configFile);

const config = JSON.parse(readFileSync(configPathOnHost, "utf8"));

const freshDb = args["--no-fresh-db"] ? false : true;

const dataset =
  firstNonEmpty(args["--dataset"], process.env.DATASET, config.dataset) ??
  (() => {
    throw new Error("Config missing dataset");
  })();

const seedValue = firstNonEmpty(
  args["--seed"],
  process.env.SEED,
  config.seed,
  1
);
const seedParsed = Number.parseInt(String(seedValue), 10);
const seed = Number.isFinite(seedParsed) ? seedParsed : 1;

const maxNodes =
  firstNonEmpty(args["--max-nodes"], process.env.MAX_NODES, config.maxNodes) ??
  "";

// k6 runs in a container, so it must reach the host via host.docker.internal on macOS.
const baseUrlForK6 =
  firstNonEmpty(args["--base-url"], process.env.BASE_URL) ??
  "http://host.docker.internal:3000";

// Prisma seed runs on the host, connecting to Postgres via the port mapping.
const databaseUrlForSeed =
  firstNonEmpty(args["--database-url"], process.env.DATABASE_URL) ??
  "postgresql://postgres:postgres@localhost:5432/interview_api?schema=public";

const reportName =
  firstNonEmpty(args["--report-name"], process.env.REPORT_NAME) ??
  `${config.id}-${dataset}-seed${seed}-${scenarioLabel(config.scenario)}`;

const runId =
  firstNonEmpty(args["--run-id"], process.env.RUN_ID) ??
  `${config.id}-${dataset}-seed${seed}-${Date.now().toString(
    36
  )}-${Math.random().toString(36).slice(2, 10)}`;

const k6Overrides = {
  VUS: firstNonEmpty(args["--vus"], process.env.VUS),
  DURATION: firstNonEmpty(args["--duration"], process.env.DURATION),
  RATE: firstNonEmpty(args["--rate"], process.env.RATE),
  TIME_UNIT: firstNonEmpty(args["--time-unit"], process.env.TIME_UNIT),
  PREALLOCATED_VUS: firstNonEmpty(
    args["--preallocated-vus"],
    process.env.PREALLOCATED_VUS
  ),
  MAX_VUS: firstNonEmpty(args["--max-vus"], process.env.MAX_VUS),
  STAGES: firstNonEmpty(args["--stages"], process.env.STAGES),
};

mkdirSync(path.resolve(repoRoot, "load/k6/results"), { recursive: true });

let exitCode = 0;
let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  runShellQuiet("docker compose down -v");
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
  if (freshDb) runShellQuiet("docker compose down -v");

  runShell("docker compose up -d --build db migrate api");

  console.log("Waiting for API readiness: http://localhost:3000/api/health");
  await waitForHealth();

  console.log(`Seeding trees via Prisma (DATASET=${dataset}, SEED=${seed})`);
  runShell("npm run seed:trees", {
    DATASET: String(dataset),
    SEED: String(seed),
    ...(maxNodes ? { MAX_NODES: maxNodes } : {}),
    DATABASE_URL: databaseUrlForSeed,
  });

  const configPathInContainer = `/scripts/${path.posix
    .join("config", path.basename(testDef.configFile))
    .replace(/\\/g, "/")}`;

  const scriptPathInContainer = `/scripts/${path.posix
    .join("tests", path.basename(testDef.scriptFile))
    .replace(/\\/g, "/")}`;

  console.log(`Running k6 ${config.id}: ${scriptPathInContainer}`);

  const dockerEnvArgs = [
    "-e",
    `BASE_URL=${baseUrlForK6}`,
    "-e",
    `RUN_ID=${runId}`,
    "-e",
    `TEST_CONFIG=${configPathInContainer}`,
    "-e",
    `DATASET=${dataset}`,
    "-e",
    `SEED=${seed}`,
    ...(maxNodes ? ["-e", `MAX_NODES=${maxNodes}`] : []),
    ...Object.entries(k6Overrides)
      .filter(([, v]) => v != null && String(v).trim().length > 0)
      .flatMap(([k, v]) => ["-e", `${k}=${String(v)}`]),
    "-e",
    "K6_WEB_DASHBOARD=true",
    "-e",
    `K6_WEB_DASHBOARD_EXPORT=/scripts/results/${reportName}.html`,
  ];

  runCmd("docker", [
    "run",
    "--rm",
    "-i",
    "-v",
    `${path.resolve(repoRoot, "load/k6")}:/scripts`,
    ...dockerEnvArgs,
    "grafana/k6",
    "run",
    "--summary-export",
    `/scripts/results/${reportName}.summary.json`,
    scriptPathInContainer,
  ]);
} catch (err) {
  exitCode = 1;
  console.error("\nLoad test failed. Dumping docker compose logs...\n");
  runShellQuiet("docker compose ps");
  runShellQuiet("docker compose logs --no-color db migrate api");
  console.error(err instanceof Error ? err.message : String(err));
} finally {
  cleanup();
  process.exit(exitCode);
}
