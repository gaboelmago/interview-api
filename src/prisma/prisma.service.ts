import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

function isPrismaErrorWithCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }

    await this.$connect();

    try {
      // Guardrail: fail with a clear message if migrations haven't been applied
      // (e.g., the TreeNode table doesn't exist in the selected schema).
      await this.treeNode.count();
    } catch (error) {
      await this.$disconnect();

      if (isPrismaErrorWithCode(error) && error.code === "P2021") {
        throw new Error(
          "Database is not migrated (TreeNode table missing). Run: npx prisma migrate dev (local) or npx prisma migrate deploy (container)."
        );
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
