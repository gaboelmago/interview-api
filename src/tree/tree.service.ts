import { Injectable } from "@nestjs/common";

import { CreateTreeNodeDto } from "./dto/create-tree-node.dto";

@Injectable()
export class TreeService {
  getTrees() {
    return [] as Array<{ id: number; label: string; children: unknown[] }>;
  }

  createNode(dto: CreateTreeNodeDto) {
    // Stub only for Phase 1; persistence is added later.
    return { id: 0, ...dto };
  }
}
