import { Module } from "@nestjs/common";

import { TreeModule } from "./tree/tree.module";

@Module({
  imports: [TreeModule],
})
export class AppModule {}
