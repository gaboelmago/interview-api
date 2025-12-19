import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TreeNode" RESTART IDENTITY CASCADE;'
  );
}

describe("Tree API (e2e)", () => {
  it("GET /api/tree returns 200 and []", async () => {
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

    await app.init();

    const prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);

    await request(app.getHttpServer()).get("/api/tree").expect(200).expect([]);

    await app.close();
  });

  it("GET /api/tree returns seeded nested output", async () => {
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

    await app.init();

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

    await app.init();

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

    await app.init();

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

    await app.init();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({})
      .expect(400);

    await app.close();
  });

  it("POST /api/tree with valid body returns 201, persists, and appears under parent", async () => {
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

    await app.init();

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

  it("POST /api/tree missing label returns 400", async () => {
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

    await app.init();

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

    await app.init();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "x", parentId: "nope" })
      .expect(400);

    await app.close();
  });

  it("POST /api/tree with nonexistent parentId returns 404", async () => {
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

    await app.init();

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

    await app.init();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send('{"label":')
      .expect(400);

    await app.close();
  });
});
