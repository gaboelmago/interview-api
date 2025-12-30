import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateTreeNodeDto } from "./dto/create-tree-node.dto";
import { getTreeGetLimits } from "../config/tree-get-limits";
import { GetTreeQueryDto } from "./dto/get-tree-query.dto";

type TreeNodeResponse = {
  id: number;
  label: string;
  children: TreeNodeResponse[];
};

export type GetTreesResult = {
  roots: TreeNodeResponse[];
  totalRoots?: number;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

  private computeMaxDepth(roots: TreeNodeResponse[]): number {
    let maxDepth = 0;
    const stack: Array<{ node: TreeNodeResponse; depth: number }> = [];
    for (const root of roots) stack.push({ node: root, depth: 1 });

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;

      if (current.depth > maxDepth) maxDepth = current.depth;
      for (const child of current.node.children) {
        stack.push({ node: child, depth: current.depth + 1 });
      }
    }

    return maxDepth;
  }

  async getTrees(query?: GetTreeQueryDto): Promise<GetTreesResult> {
    const limits = getTreeGetLimits();

    const rows = await this.prisma.treeNode.findMany({
      select: { id: true, label: true, parentId: true },
      orderBy: { id: "asc" },
    });

    if (limits.maxNodes != null && rows.length > limits.maxNodes) {
      throw new BadRequestException(
        `Tree node limit exceeded: ${rows.length} nodes > TREE_GET_MAX_NODES=${limits.maxNodes}`
      );
    }

    const nodesById = new Map<number, TreeNodeResponse>();
    for (const row of rows) {
      nodesById.set(row.id, { id: row.id, label: row.label, children: [] });
    }

    const rootsAll: TreeNodeResponse[] = [];
    for (const row of rows) {
      const node = nodesById.get(row.id);
      if (!node) continue;

      if (row.parentId == null) {
        rootsAll.push(node);
        continue;
      }

      const parent = nodesById.get(row.parentId);
      if (parent) parent.children.push(node);
      else rootsAll.push(node);
    }

    const sortRecursively = (items: TreeNodeResponse[]) => {
      items.sort((a, b) => a.id - b.id);
      for (const item of items) sortRecursively(item.children);
    };
    sortRecursively(rootsAll);

    if (limits.maxDepth != null) {
      const depth = this.computeMaxDepth(rootsAll);
      if (depth > limits.maxDepth) {
        throw new BadRequestException(
          `Tree depth limit exceeded: depth=${depth} > TREE_GET_MAX_DEPTH=${limits.maxDepth}`
        );
      }
    }

    // Optional minimal filtering/pagination (Phase 17 Parts D/E)
    let roots = rootsAll;

    if (query?.rootId != null) {
      const row = rows.find((r) => r.id === query.rootId);
      if (!row) {
        throw new NotFoundException(`Root node ${query.rootId} not found`);
      }

      if (row.parentId != null) {
        throw new BadRequestException(
          `Node ${query.rootId} is not a root node`
        );
      }

      const root = nodesById.get(query.rootId);
      roots = root ? [root] : [];
      return { roots };
    }

    const page = query?.page;
    const pageSize = query?.pageSize;
    if (page != null || pageSize != null) {
      if (page == null || pageSize == null) {
        throw new BadRequestException(
          "Both page and pageSize must be provided when using pagination"
        );
      }

      const totalRoots = rootsAll.length;
      const start = (page - 1) * pageSize;
      roots =
        start >= totalRoots ? [] : rootsAll.slice(start, start + pageSize);
      return { roots, totalRoots, page, pageSize };
    }

    return { roots };
  }

  async createNode(dto: CreateTreeNodeDto) {
    if (dto.parentId == null) {
      return this.prisma.treeNode.create({
        data: { label: dto.label },
        select: { id: true, label: true, parentId: true },
      });
    }

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
