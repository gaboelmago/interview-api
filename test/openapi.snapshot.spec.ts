import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import * as request from "supertest";

const SNAPSHOT_PATH = resolve(__dirname, "..", "openapi.snapshot.json");

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

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

describe("OpenAPI snapshot", () => {
  it("matches openapi.snapshot.json", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);

    const actual = sortDeep(res.body);

    if (process.env.UPDATE_OPENAPI_SNAPSHOT === "true") {
      writeFileSync(SNAPSHOT_PATH, JSON.stringify(actual, null, 2) + "\n", {
        encoding: "utf-8",
      });
      await app.close();
      return;
    }

    const expectedRaw = readFileSync(SNAPSHOT_PATH, { encoding: "utf-8" });
    const expected = JSON.parse(expectedRaw) as unknown;

    expect(actual).toEqual(expected);

    await app.close();
  });
});
