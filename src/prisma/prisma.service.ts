import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { maybeApplyStatementTimeoutEnv } from "../config/db-timeout";

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

    // Phase 17 Part C: opt-in DB statement timeout (server-side) via env.
    // This does NOT connect on startup, preserving liveness-only semantics.
    maybeApplyStatementTimeoutEnv(process.env);
  }

  /**
   * Explicit readiness check used by /api/ready and tests.
   *
   * NOTE: We intentionally do not connect on app startup so /api/health remains
   * liveness-only even when the DB is unreachable.
   */
  async assertDatabaseReady(): Promise<void> {
    await this.$connect();

    try {
      // Basic connectivity ping.
      await this.$queryRaw`SELECT 1`;

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
