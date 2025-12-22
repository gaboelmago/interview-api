import * as request from "supertest";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

describe("Black-box E2E: /api/health", () => {
  it("returns 200 and { status: ok }", async () => {
    await request(BASE_URL)
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });
});
