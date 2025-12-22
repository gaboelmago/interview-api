import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TreeModule } from "./tree/tree.module";

@Module({
  imports: [PrismaModule, TreeModule, HealthModule],
})
export class AppModule {}
