import { Body, Controller, Get, Post } from "@nestjs/common";

import { CreateTreeNodeDto } from "./dto/create-tree-node.dto";
import { TreeService } from "./tree.service";

@Controller("tree")
export class TreeController {
  constructor(private readonly treeService: TreeService) {}

  @Get()
  getTrees() {
    return this.treeService.getTrees();
  }

  @Post()
  createNode(@Body() dto: CreateTreeNodeDto) {
    return this.treeService.createNode(dto);
  }
}
