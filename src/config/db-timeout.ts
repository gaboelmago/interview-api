function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

/**
 * Returns a DATABASE_URL with libpq `options` set to configure statement_timeout.
 *
 * Prisma passes the URL through to the Postgres engine; statement_timeout is
 * enforced server-side by Postgres.
 */
export function withStatementTimeout(
  databaseUrl: string,
  statementTimeoutMs: number
): string {
  const url = new URL(databaseUrl);

  const desired = `-c statement_timeout=${statementTimeoutMs}`;
  const existing = url.searchParams.get("options");

  if (existing && existing.includes("statement_timeout")) {
    return url.toString();
  }

  const next =
    existing && existing.trim().length > 0 ? `${existing} ${desired}` : desired;
  url.searchParams.set("options", next);
  return url.toString();
}

export function maybeApplyStatementTimeoutEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const ms = parsePositiveInt(env.DB_STATEMENT_TIMEOUT_MS);
  if (ms == null) return;

  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) return;

  env.DATABASE_URL = withStatementTimeout(dbUrl, ms);
}
