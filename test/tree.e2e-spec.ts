import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/bootstrap/configure-app";
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

  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app);

  await app.init();
  return { app, moduleRef };
}

describe("Tree API (e2e)", () => {
  it("GET /api/tree does not 500 on very deep trees (should reject with depth limit)", async () => {
    jest.setTimeout(60_000);

    const prevDepth = process.env.TREE_GET_MAX_DEPTH;
    const prevNodes = process.env.TREE_GET_MAX_NODES;

    // Expected behavior: a bounded, non-500 rejection via the depth cap.
    process.env.TREE_GET_MAX_DEPTH = "50";
    process.env.TREE_GET_MAX_NODES = "50000";

    const { app, moduleRef } = await createTestApp();

    try {
      const prisma = moduleRef.get(PrismaService);
      await resetDb(prisma);

      // Deep enough to overflow recursive traversal on typical Node call stacks.
      const N = 20_000;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "TreeNode" ("id", "label", "parentId") VALUES (1, 'n1', NULL);`
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO "TreeNode" ("id", "label", "parentId")
         SELECT i, 'n' || i, i - 1
         FROM generate_series(2, ${N}) AS i;`
      );

      const res = await request(app.getHttpServer())
        .get("/api/tree")
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        error: "Bad Request",
        message: expect.any(String),
        path: "/api/tree",
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
    } finally {
      await app.close();
      await moduleRef.close();

      if (prevDepth === undefined) delete process.env.TREE_GET_MAX_DEPTH;
      else process.env.TREE_GET_MAX_DEPTH = prevDepth;

      if (prevNodes === undefined) delete process.env.TREE_GET_MAX_NODES;
      else process.env.TREE_GET_MAX_NODES = prevNodes;
    }
  });

  it("POST /api/tree rejects oversized JSON payloads with 413", async () => {
    const prevLimit = process.env.BODY_LIMIT;
    process.env.BODY_LIMIT = "1kb";

    const { app } = await createTestApp();

    // Roughly > 1kb once JSON encoding overhead is included.
    const bigLabel = "a".repeat(2_500);

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: bigLabel })
      .expect(413);

    await app.close();

    if (prevLimit === undefined) delete process.env.BODY_LIMIT;
    else process.env.BODY_LIMIT = prevLimit;
  });

  it("GET /api/health returns 200 and {status: ok}", async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });

    await app.close();
  });

  it("GET /api/health includes response header X-Request-Id (non-empty)", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
    expect(String(res.headers["x-request-id"]).length).toBeGreaterThan(0);

    await app.close();
  });

  it("GET /api/health echoes inbound X-Request-Id", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/health")
      .set("X-Request-Id", "test-123")
      .expect(200);

    expect(res.headers["x-request-id"]).toBe("test-123");

    await app.close();
  });

  it("GET /api/tree returns 200 and []", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    await request(app.getHttpServer()).get("/api/tree").expect(200).expect([]);

    await app.close();
  });

  it("GET /api/tree rejects when TREE_GET_MAX_NODES is exceeded", async () => {
    const prev = process.env.TREE_GET_MAX_NODES;
    process.env.TREE_GET_MAX_NODES = "2";

    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });
    await prisma.treeNode.create({
      data: { label: "child", parentId: root.id },
    });
    await prisma.treeNode.create({
      data: { label: "child-2", parentId: root.id },
    });

    const res = await request(app.getHttpServer()).get("/api/tree").expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(String),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();

    if (prev === undefined) delete process.env.TREE_GET_MAX_NODES;
    else process.env.TREE_GET_MAX_NODES = prev;
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
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("unknown route includes requestId in body when X-Request-Id is provided", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/does-not-exist")
      .set("X-Request-Id", "test-err-1")
      .expect(404);

    expect(res.body.requestId).toBe("test-err-1");

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

  it("GET /api/tree supports root-level pagination and returns pagination headers", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const rootA = await prisma.treeNode.create({ data: { label: "a" } });
    const aChild = await prisma.treeNode.create({
      data: { label: "a-1", parentId: rootA.id },
    });
    const rootB = await prisma.treeNode.create({ data: { label: "b" } });
    await prisma.treeNode.create({ data: { label: "c" } });

    const res = await request(app.getHttpServer())
      .get("/api/tree?page=1&pageSize=2")
      .expect(200);

    expect(res.headers["x-total-roots"]).toBe("3");
    expect(res.headers["x-page"]).toBe("1");
    expect(res.headers["x-page-size"]).toBe("2");

    expect(res.body).toEqual([
      {
        id: rootA.id,
        label: "a",
        children: [{ id: aChild.id, label: "a-1", children: [] }],
      },
      { id: rootB.id, label: "b", children: [] },
    ]);

    await app.close();
  });

  it("GET /api/tree pagination returns 200 and [] when page is beyond range (still sets headers)", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    await prisma.treeNode.create({ data: { label: "a" } });
    await prisma.treeNode.create({ data: { label: "b" } });
    await prisma.treeNode.create({ data: { label: "c" } });

    const res = await request(app.getHttpServer())
      .get("/api/tree?page=99&pageSize=2")
      .expect(200);

    expect(res.headers["x-total-roots"]).toBe("3");
    expect(res.headers["x-page"]).toBe("99");
    expect(res.headers["x-page-size"]).toBe("2");
    expect(res.body).toEqual([]);

    await app.close();
  });

  it("GET /api/tree pagination rejects invalid page/pageSize", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .get("/api/tree?page=0&pageSize=101")
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
      path: "/api/tree?page=0&pageSize=101",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("GET /api/tree supports filtering by rootId (returns single tree array)", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });
    const child = await prisma.treeNode.create({
      data: { label: "child", parentId: root.id },
    });
    await prisma.treeNode.create({ data: { label: "other-root" } });

    await request(app.getHttpServer())
      .get(`/api/tree?rootId=${root.id}`)
      .expect(200)
      .expect([
        {
          id: root.id,
          label: "root",
          children: [{ id: child.id, label: "child", children: [] }],
        },
      ]);

    await app.close();
  });

  it("GET /api/tree?rootId=... returns 404 when root does not exist", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const res = await request(app.getHttpServer())
      .get("/api/tree?rootId=999")
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: expect.any(String),
      path: "/api/tree?rootId=999",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("GET /api/tree?rootId=... rejects when the node exists but is not a root", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });
    const child = await prisma.treeNode.create({
      data: { label: "child", parentId: root.id },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/tree?rootId=${child.id}`)
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(String),
      path: `/api/tree?rootId=${child.id}`,
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("GET /api/tree rejects combining rootId with pagination", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const root = await prisma.treeNode.create({ data: { label: "root" } });

    const res = await request(app.getHttpServer())
      .get(`/api/tree?rootId=${root.id}&page=1&pageSize=1`)
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(String),
      path: `/api/tree?rootId=${root.id}&page=1&pageSize=1`,
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

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

  it("GET /api/tree rejects when TREE_GET_MAX_DEPTH is exceeded", async () => {
    const prev = process.env.TREE_GET_MAX_DEPTH;
    process.env.TREE_GET_MAX_DEPTH = "3";

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
    await prisma.treeNode.create({
      data: { label: "n4", parentId: n3.id },
    });

    const res = await request(app.getHttpServer()).get("/api/tree").expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(String),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();

    if (prev === undefined) delete process.env.TREE_GET_MAX_DEPTH;
    else process.env.TREE_GET_MAX_DEPTH = prev;
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

  it("POST /api/tree validation errors use the standard error envelope", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({})
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("POST /api/tree rejects whitespace-only label", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "   " })
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("POST /api/tree rejects label longer than 255 characters (even when under BODY_LIMIT)", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "a".repeat(256) })
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("POST /api/tree rejects label with control characters", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "hi\nthere" })
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("POST /api/tree rejects application/x-www-form-urlencoded with 415 (JSON-only)", async () => {
    const { app } = await createTestApp();

    const res = await request(app.getHttpServer())
      .post("/api/tree")
      .type("form")
      .send({ label: "root" })
      .expect(415);

    expect(res.body).toEqual({
      statusCode: 415,
      error: expect.any(String),
      message: expect.any(String),
      path: "/api/tree",
      timestamp: expect.any(String),
      requestId: expect.any(String),
    });

    await app.close();
  });

  it("POST /api/tree trims label before persisting", async () => {
    const { app, moduleRef } = await createTestApp();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    const createdRes = await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "  root  " })
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
    await moduleRef.close();
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
