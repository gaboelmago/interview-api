import * as request from "supertest";

async function createIsolatedTestApp() {
  // Important: avoid mixing multiple copies of Nest packages in the same container.
  // Using isolateModulesAsync here can lead to token mismatches (e.g., Reflector).
  jest.resetModules();

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
  return app;
}

describe("Throttling (e2e)", () => {
  it("GET /api/health succeeds under normal request volume", async () => {
    const prevTtl = process.env.THROTTLE_TTL_SECONDS;
    const prevLimit = process.env.THROTTLE_LIMIT;

    process.env.THROTTLE_TTL_SECONDS = "60";
    process.env.THROTTLE_LIMIT = "3";

    const app = await createIsolatedTestApp();

    const server = app.getHttpServer();

    // Under the derived read limit, all should pass.
    for (let i = 0; i < 5; i++) {
      await request(server).get("/api/health").expect(200);
    }

    await app.close();

    if (prevTtl === undefined) delete process.env.THROTTLE_TTL_SECONDS;
    else process.env.THROTTLE_TTL_SECONDS = prevTtl;

    if (prevLimit === undefined) delete process.env.THROTTLE_LIMIT;
    else process.env.THROTTLE_LIMIT = prevLimit;
  });

  it("rate limit exceeded returns 429", async () => {
    const prevTtl = process.env.THROTTLE_TTL_SECONDS;
    const prevLimit = process.env.THROTTLE_LIMIT;

    process.env.THROTTLE_TTL_SECONDS = "60";
    process.env.THROTTLE_LIMIT = "3";

    const app = await createIsolatedTestApp();

    const server = app.getHttpServer();

    // POST /api/tree uses a stricter derived write limit (floor(limit/2)).
    await request(server)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root-1" })
      .expect(201);

    await request(server)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root-2" })
      .expect(429);

    await app.close();

    if (prevTtl === undefined) delete process.env.THROTTLE_TTL_SECONDS;
    else process.env.THROTTLE_TTL_SECONDS = prevTtl;

    if (prevLimit === undefined) delete process.env.THROTTLE_LIMIT;
    else process.env.THROTTLE_LIMIT = prevLimit;
  });
});
