function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type ReadyConfig = {
  dbTimeoutMs: number;
};

export function getReadyConfig(): ReadyConfig {
  // Keep /api/ready fast and bounded.
  const dbTimeoutMs = parsePositiveInt(process.env.READY_DB_TIMEOUT_MS) ?? 500;
  return { dbTimeoutMs };
}
