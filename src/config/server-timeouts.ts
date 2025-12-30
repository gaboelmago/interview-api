function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type ServerTimeouts = {
  headersTimeoutMs: number;
  requestTimeoutMs: number;
  keepAliveTimeoutMs: number;
};

export function getServerTimeouts(
  env: NodeJS.ProcessEnv = process.env
): ServerTimeouts {
  // Defaults align with Node's typical defaults.
  const keepAliveTimeoutMs =
    parsePositiveInt(env.SERVER_KEEP_ALIVE_TIMEOUT_MS) ?? 5_000;

  const headersTimeoutMsRaw =
    parsePositiveInt(env.SERVER_HEADERS_TIMEOUT_MS) ?? 60_000;

  // Node requires headersTimeout > keepAliveTimeout.
  const headersTimeoutMs = Math.max(
    headersTimeoutMsRaw,
    keepAliveTimeoutMs + 1_000
  );

  const requestTimeoutMs =
    parsePositiveInt(env.SERVER_REQUEST_TIMEOUT_MS) ?? 300_000;

  return { headersTimeoutMs, requestTimeoutMs, keepAliveTimeoutMs };
}
