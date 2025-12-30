function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type ThrottleConfig = {
  ttlSeconds: number;
  limit: number;
};

export function getThrottleConfig(): ThrottleConfig {
  // Default chosen to be conservative but not disruptive to tests/dev.
  const ttlSeconds = parsePositiveInt(process.env.THROTTLE_TTL_SECONDS) ?? 60;
  const limit = parsePositiveInt(process.env.THROTTLE_LIMIT) ?? 100;

  return { ttlSeconds, limit };
}

export function getWriteThrottleLimit(globalLimit: number): number {
  // Stricter for mutations; derived from global limit to remain env-driven.
  return Math.max(1, Math.floor(globalLimit / 2));
}

export function getReadThrottleLimit(globalLimit: number): number {
  // More permissive for safe reads.
  return Math.max(1, globalLimit * 2);
}
