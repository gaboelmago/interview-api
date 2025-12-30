/* global __ENV, open */

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function loadTestConfig() {
  const configPath = __ENV.TEST_CONFIG;
  if (!configPath) {
    throw new Error(
      "Missing TEST_CONFIG env var. Example: -e TEST_CONFIG=/scripts/config/test1-baseline-small.json"
    );
  }

  const raw = open(configPath);
  const config = JSON.parse(raw);

  // Allow simple overrides via env for quick experimentation.
  // These are optional and intentionally minimal.
  const dataset = __ENV.DATASET || config.dataset;
  const maxNodes = __ENV.MAX_NODES ? Number(__ENV.MAX_NODES) : config.maxNodes;
  const seed = __ENV.SEED ? Number(__ENV.SEED) : config.seed;

  const scenario = { ...(config.scenario || {}) };
  if (__ENV.VUS) scenario.vus = Number(__ENV.VUS);
  if (__ENV.DURATION) scenario.duration = __ENV.DURATION;
  if (__ENV.RATE) scenario.rate = Number(__ENV.RATE);
  if (__ENV.TIME_UNIT) scenario.timeUnit = __ENV.TIME_UNIT;
  if (__ENV.PREALLOCATED_VUS)
    scenario.preAllocatedVUs = Number(__ENV.PREALLOCATED_VUS);
  if (__ENV.MAX_VUS) scenario.maxVUs = Number(__ENV.MAX_VUS);

  // STAGES override as JSON string: e.g. STAGES='[{"duration":"30s","target":10}, ...]'
  if (__ENV.STAGES) scenario.stages = parseJson(__ENV.STAGES, scenario.stages);

  return {
    ...config,
    dataset,
    maxNodes,
    seed,
    scenario,
  };
}

export function buildK6Options(config) {
  const thresholds = config.thresholds || {};

  // Map our JSON "scenario" into a k6 options structure.
  // For now: single-scenario options only.
  const scenario = config.scenario || {};
  const executor = scenario.executor;
  if (!executor) throw new Error("Config is missing scenario.executor");

  // Support both styles:
  // - constant-vus: top-level vus/duration
  // - others: use scenarios.default
  if (executor === "constant-vus") {
    return {
      vus: scenario.vus,
      duration: scenario.duration,
      thresholds,
    };
  }

  return {
    scenarios: {
      default: {
        executor,
        ...scenario,
      },
    },
    thresholds,
  };
}
