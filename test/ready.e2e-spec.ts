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

describe("Ready (e2e)", () => {
  it("GET /api/ready returns 200 and {status: ok, db: ok} when DB is reachable", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/ready")
      .expect(200)
      .expect({ status: "ok", db: "ok" });

    await app.close();
  });

  it("GET /api/ready returns 503 and {status: degraded, db: down} when DB is unreachable", async () => {
    const prevDbUrl = process.env.DATABASE_URL;
    const prevTimeout = process.env.READY_DB_TIMEOUT_MS;

    // Point Prisma to an unreachable port and keep the readiness check bounded.
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:59999/interview_api?schema=public";
    process.env.READY_DB_TIMEOUT_MS = "250";

    // Ensure PrismaClient reads the new env values.
    jest.resetModules();

    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/ready")
      .expect(503)
      .expect({ status: "degraded", db: "down" });

    // Liveness should remain dependency-free.
    await request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });

    await app.close();

    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;

    if (prevTimeout === undefined) delete process.env.READY_DB_TIMEOUT_MS;
    else process.env.READY_DB_TIMEOUT_MS = prevTimeout;
  });
});
