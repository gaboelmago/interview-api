import { Module } from "@nestjs/common";

import { PrismaModule } from "./prisma/prisma.module";
import { TreeModule } from "./tree/tree.module";

@Module({
  imports: [PrismaModule, TreeModule],
})
export class AppModule {}
