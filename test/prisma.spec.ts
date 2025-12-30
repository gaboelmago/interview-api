import { Test } from "@nestjs/testing";

import { PrismaClient } from "@prisma/client";

import { PrismaService } from "../src/prisma/prisma.service";

function withSchema(databaseUrl: string, schema: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

describe("Prisma (Phase 2)", () => {
  it("fails fast when DATABASE_URL is missing", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";

    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const prisma = moduleRef.get(PrismaService);

    await expect(prisma.onModuleInit()).rejects.toThrow(
      /DATABASE_URL is required/
    );

    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  });

  it("throws a clear error when migrations are not applied (empty schema)", async () => {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Create .env from .env.example and point it at a running Postgres."
      );
    }

    const admin = new PrismaClient({
      datasources: {
        db: { url: baseUrl },
      },
    });

    const emptySchema = `test_empty_${Date.now()}`;
    await admin.$connect();
    await admin.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${emptySchema}"`
    );

    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = withSchema(baseUrl, emptySchema);

    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const prisma = moduleRef.get(PrismaService);

    await expect(prisma.assertDatabaseReady()).rejects.toThrow(
      /Database is not migrated/
    );

    // Cleanup
    process.env.DATABASE_URL = previous;
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${emptySchema}" CASCADE`
    );
    await admin.$disconnect();
  });

  it("connects and can create a TreeNode", async () => {
    // Requires a running Postgres and a migrated schema.
    // Uses DATABASE_URL from the environment (.env is loaded automatically in src/main.ts only).
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Create .env from .env.example and point it at a running Postgres."
      );
    }

    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const prisma = moduleRef.get(PrismaService);
    await prisma.assertDatabaseReady();

    await prisma.treeNode.deleteMany();

    const created = await prisma.treeNode.create({
      data: { label: "root" },
      select: { id: true, label: true, parentId: true },
    });

    expect(created.label).toBe("root");
    expect(created.parentId).toBeNull();

    await prisma.treeNode.deleteMany();
    await prisma.onModuleDestroy();
  });
});
