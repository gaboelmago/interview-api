import { Module } from "@nestjs/common";

import { TreeController } from "./tree.controller";
import { TreeService } from "./tree.service";
import { JsonOnlyGuard } from "./guards/json-only.guard";

@Module({
  controllers: [TreeController],
  providers: [TreeService, JsonOnlyGuard],
})
export class TreeModule {}
