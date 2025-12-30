import * as request from "supertest";

async function createTestApp() {
  const [{ Test }, { AppModule }, { configureApp }] = await Promise.all([
    import("@nestjs/testing"),
    import("../src/app.module"),
    import("../src/bootstrap/configure-app"),
  ]);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app);

  await app.init();
  return { app };
}

describe("OpenAPI (e2e)", () => {
  it("GET /api/openapi.json returns 200 and includes tree endpoints", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);

    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual(expect.any(Object));

    // Keep assertions stable and minimal.
    expect(res.body.paths).toEqual(expect.any(Object));

    const pathKeys = Object.keys(res.body.paths ?? {});
    expect(pathKeys.length).toBeGreaterThan(0);

    // Depending on Nest/Swagger internals, paths may be emitted as
    // "/tree", "/v1/tree", or include the global prefix.
    const hasTreePath = pathKeys.some((p) => p.endsWith("/tree"));
    expect(hasTreePath).toBe(true);

    await app.close();
  });

  it("GET /api/v1/health returns 200 (URI versioning)", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect({ status: "ok" });

    await app.close();
  });
});
