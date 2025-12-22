import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { PrismaService } from "../src/prisma/prisma.service";

async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TreeNode" RESTART IDENTITY CASCADE;'
  );
}

async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return { app, moduleRef };
}

describe("Tree API (e2e)", () => {
  it("GET /api/tree returns 200 and []", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    await request(app.getHttpServer()).get("/api/tree").expect(200).expect([]);

    await app.close();
  });

  it("unknown route returns 404 with consistent error shape", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/does-not-exist")
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "Cannot GET /api/does-not-exist",
      path: "/api/does-not-exist",
      timestamp: expect.any(String),
    });

    await app.close();
  });

  it("GET /api/tree returns seeded nested output", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });
    const bear = await prisma.treeNode.create({
      data: { label: "bear", parentId: root.id },
    });
    const cat = await prisma.treeNode.create({
      data: { label: "cat", parentId: bear.id },
    });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([
        {
          id: root.id,
          label: "root",
          children: [
            {
              id: bear.id,
              label: "bear",
              children: [{ id: cat.id, label: "cat", children: [] }],
            },
          ],
        },
      ]);

    await app.close();
  });

  it("GET /api/tree returns multiple root nodes", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const a = await prisma.treeNode.create({ data: { label: "a" } });
    const b = await prisma.treeNode.create({ data: { label: "b" } });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([
        { id: a.id, label: "a", children: [] },
        { id: b.id, label: "b", children: [] },
      ]);

    await app.close();
  });

  it("GET /api/tree supports deep nesting (>2 levels)", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const n1 = await prisma.treeNode.create({ data: { label: "n1" } });
    const n2 = await prisma.treeNode.create({
      data: { label: "n2", parentId: n1.id },
    });
    const n3 = await prisma.treeNode.create({
      data: { label: "n3", parentId: n2.id },
    });
    const n4 = await prisma.treeNode.create({
      data: { label: "n4", parentId: n3.id },
    });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([
        {
          id: n1.id,
          label: "n1",
          children: [
            {
              id: n2.id,
              label: "n2",
              children: [
                {
                  id: n3.id,
                  label: "n3",
                  children: [{ id: n4.id, label: "n4", children: [] }],
                },
              ],
            },
          ],
        },
      ]);

    await app.close();
  });

  it("POST /api/tree with empty body returns 400", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({})
      .expect(400);

    await app.close();
  });

  it("POST /api/tree creates a new root when parentId is missing", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const createdRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root" })
      .expect(201);

    expect(createdRes.body).toEqual({
      id: expect.any(Number),
      label: "root",
      parentId: null,
    });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([{ id: createdRes.body.id, label: "root", children: [] }]);

    await app.close();
  });

  it("POST /api/tree creates a new root when parentId is null", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const createdRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root", parentId: null })
      .expect(201);

    expect(createdRes.body).toEqual({
      id: expect.any(Number),
      label: "root",
      parentId: null,
    });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([{ id: createdRes.body.id, label: "root", children: [] }]);

    await app.close();
  });

  it("POST /api/tree with valid body returns 201, persists, and appears under parent", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });

    const createdRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "child", parentId: root.id })
      .expect(201);

    expect(createdRes.body).toEqual({
      id: expect.any(Number),
      label: "child",
      parentId: root.id,
    });

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([
        {
          id: root.id,
          label: "root",
          children: [
            {
              id: createdRes.body.id,
              label: "child",
              children: [],
            },
          ],
        },
      ]);

    await app.close();
  });

  it("POST creates nodes at various depths across multiple trees; GET returns full nested trees", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    // Create multiple roots via the API
    const rootARes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root-a" })
      .expect(201);
    const rootA = rootARes.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    const rootBRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root-b" })
      .expect(201);
    const rootB = rootBRes.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    const rootCRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "root-c" })
      .expect(201);
    const rootC = rootCRes.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // Add children under rootA (multiple siblings)
    const a1Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a-1", parentId: rootA.id })
      .expect(201);
    const a1 = a1Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    const a2Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a-2", parentId: rootA.id })
      .expect(201);
    const a2 = a2Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // Add grandchildren under a1
    const a11Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a-1-1", parentId: a1.id })
      .expect(201);
    const a11 = a11Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    const a12Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a-1-2", parentId: a1.id })
      .expect(201);
    const a12 = a12Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // Add great-grandchild under a12 (depth 3)
    const a121Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a-1-2-1", parentId: a12.id })
      .expect(201);
    const a121 = a121Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // Add children under rootB
    const b1Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "b-1", parentId: rootB.id })
      .expect(201);
    const b1 = b1Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // Add grandchild under b1
    const b11Res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "b-1-1", parentId: b1.id })
      .expect(201);
    const b11 = b11Res.body as {
      id: number;
      label: string;
      parentId: number | null;
    };

    // rootC stays empty

    await request(app.getHttpServer())
      .get("/api/tree")
      .expect(200)
      .expect([
        {
          id: rootA.id,
          label: "root-a",
          children: [
            {
              id: a1.id,
              label: "a-1",
              children: [
                { id: a11.id, label: "a-1-1", children: [] },
                {
                  id: a12.id,
                  label: "a-1-2",
                  children: [{ id: a121.id, label: "a-1-2-1", children: [] }],
                },
              ],
            },
            { id: a2.id, label: "a-2", children: [] },
          ],
        },
        {
          id: rootB.id,
          label: "root-b",
          children: [
            {
              id: b1.id,
              label: "b-1",
              children: [{ id: b11.id, label: "b-1-1", children: [] }],
            },
          ],
        },
        { id: rootC.id, label: "root-c", children: [] },
      ]);

    await app.close();
  });

  it("POST /api/tree missing label returns 400", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);
    const root = await prisma.treeNode.create({ data: { label: "root" } });

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ parentId: root.id })
      .expect(400);

    await app.close();
  });

  it("POST /api/tree non-integer parentId returns 400", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "x", parentId: "nope" })
      .expect(400);

    await app.close();
  });

  it("POST /api/tree with nonexistent parentId returns 404", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);
    const root = await prisma.treeNode.create({ data: { label: "root" } });

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "child", parentId: root.id + 9999 })
      .expect(404);

    await app.close();
  });

  it("POST /api/tree with invalid JSON returns 400", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send('{"label":')
      .expect(400);

    await app.close();
  });
});
