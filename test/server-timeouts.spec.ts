import { getServerTimeouts } from "../src/config/server-timeouts";

describe("getServerTimeouts (Phase 17 Part C)", () => {
  it("uses defaults when env is missing", () => {
    expect(getServerTimeouts({} as any)).toEqual({
      keepAliveTimeoutMs: 5000,
      headersTimeoutMs: 60000,
      requestTimeoutMs: 300000,
    });
  });

  it("parses env values and enforces headersTimeout > keepAliveTimeout", () => {
    const t = getServerTimeouts({
      SERVER_KEEP_ALIVE_TIMEOUT_MS: "10000",
      SERVER_HEADERS_TIMEOUT_MS: "1000",
      SERVER_REQUEST_TIMEOUT_MS: "1234",
    } as any);

    expect(t.keepAliveTimeoutMs).toBe(10000);
    expect(t.requestTimeoutMs).toBe(1234);

    // Adjusted upward to satisfy Node constraint.
    expect(t.headersTimeoutMs).toBeGreaterThan(t.keepAliveTimeoutMs);
  });

  it("ignores invalid values and falls back to defaults", () => {
    const t = getServerTimeouts({
      SERVER_KEEP_ALIVE_TIMEOUT_MS: "nope",
      SERVER_HEADERS_TIMEOUT_MS: "-1",
      SERVER_REQUEST_TIMEOUT_MS: "0",
    } as any);

    expect(t).toEqual({
      keepAliveTimeoutMs: 5000,
      headersTimeoutMs: 60000,
      requestTimeoutMs: 300000,
    });
  });
});
