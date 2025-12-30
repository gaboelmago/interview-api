import {
  maybeApplyStatementTimeoutEnv,
  withStatementTimeout,
} from "../src/config/db-timeout";

describe("db-timeout helpers (Phase 17 Part C)", () => {
  it("injects statement_timeout via options when options is missing", () => {
    const out = withStatementTimeout(
      "postgresql://u:p@localhost:5432/db?schema=public",
      250
    );

    const url = new URL(out);
    expect(url.searchParams.get("schema")).toBe("public");

    const options = url.searchParams.get("options");
    expect(options).toContain("statement_timeout=250");
  });

  it("appends statement_timeout when options exists and does not already include it", () => {
    const out = withStatementTimeout(
      "postgresql://u:p@localhost:5432/db?options=-c%20lock_timeout=100&schema=public",
      500
    );

    const url = new URL(out);
    const options = url.searchParams.get("options");
    expect(options).toContain("lock_timeout=100");
    expect(options).toContain("statement_timeout=500");
  });

  it("is a no-op when options already contains statement_timeout", () => {
    const input =
      "postgresql://u:p@localhost:5432/db?options=-c%20statement_timeout=123&schema=public";
    const out = withStatementTimeout(input, 999);

    expect(out).toBe(new URL(input).toString());
  });

  it("maybeApplyStatementTimeoutEnv updates DATABASE_URL only when env is configured", () => {
    const env: NodeJS.ProcessEnv = {
      DB_STATEMENT_TIMEOUT_MS: "1000",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
    };

    maybeApplyStatementTimeoutEnv(env);

    const url = new URL(env.DATABASE_URL!);
    expect(url.searchParams.get("options")).toContain("statement_timeout=1000");
  });

  it("maybeApplyStatementTimeoutEnv is a no-op when DB_STATEMENT_TIMEOUT_MS is missing", () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
    };

    const before = env.DATABASE_URL;
    maybeApplyStatementTimeoutEnv(env);
    expect(env.DATABASE_URL).toBe(before);
  });
});
