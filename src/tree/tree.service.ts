import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateTreeNodeDto } from "./dto/create-tree-node.dto";

type TreeNodeResponse = {
  id: number;
  label: string;
  children: TreeNodeResponse[];
};

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrees(): Promise<TreeNodeResponse[]> {
    const rows = await this.prisma.treeNode.findMany({
      select: { id: true, label: true, parentId: true },
      orderBy: { id: "asc" },
    });

    const nodesById = new Map<number, TreeNodeResponse>();
    for (const row of rows) {
      nodesById.set(row.id, { id: row.id, label: row.label, children: [] });
    }

    const roots: TreeNodeResponse[] = [];
    for (const row of rows) {
      const node = nodesById.get(row.id);
      if (!node) continue;

      if (row.parentId == null) {
        roots.push(node);
        continue;
      }

      const parent = nodesById.get(row.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    const sortRecursively = (items: TreeNodeResponse[]) => {
      items.sort((a, b) => a.id - b.id);
      for (const item of items) sortRecursively(item.children);
    };
    sortRecursively(roots);

    return roots;
  }

  async createNode(dto: CreateTreeNodeDto) {
    const parent = await this.prisma.treeNode.findUnique({
      where: { id: dto.parentId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException(`Parent node ${dto.parentId} not found`);
    }

    return this.prisma.treeNode.create({
      data: { label: dto.label, parentId: dto.parentId },
      select: { id: true, label: true, parentId: true },
    });
  }
}
