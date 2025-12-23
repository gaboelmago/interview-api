import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * DATASET PRESETS
 * Change DATASET to switch shapes instantly.
 */
const DATASETS = {
  small: {
    roots: 5,
    minDepth: 3,
    maxDepth: 4,
    branchingFactor: 2,
  },
  deep: {
    roots: 3,
    minDepth: 8,
    maxDepth: 10,
    branchingFactor: 2,
  },
  wide: {
    roots: 10,
    minDepth: 4,
    maxDepth: 5,
    branchingFactor: 4,
  },
  stress: {
    roots: 20,
    minDepth: 6,
    maxDepth: 8,
    branchingFactor: 3,
  },
} as const;

const DATASET =
  (process.env.DATASET as keyof typeof DATASETS | undefined) ?? "stress";

const MAX_NODES = process.env.MAX_NODES
  ? Number.parseInt(process.env.MAX_NODES, 10)
  : null;

type NodeRow = {
  id: number;
  label: string;
  parentId: number | null;
};

let nextId = 1;
let rows: NodeRow[] = [];

function createSubtree(
  parentId: number | null,
  path: number[],
  depth: number,
  maxDepth: number,
  branchingFactor: number
) {
  if (MAX_NODES != null && rows.length >= MAX_NODES) return;

  const id = nextId++;
  const label = `node-${path.join(".")}`;

  rows.push({
    id,
    label,
    parentId,
  });

  if (depth >= maxDepth) return;

  for (let i = 1; i <= branchingFactor; i++) {
    if (MAX_NODES != null && rows.length >= MAX_NODES) break;
    createSubtree(id, [...path, i], depth + 1, maxDepth, branchingFactor);
  }
}

async function main() {
  const config = DATASETS[DATASET];
  if (!config) throw new Error(`Unknown dataset: ${DATASET}`);

  console.log(`Seeding dataset: ${DATASET}`);
  console.log(config);

  // clean slate (fast + resets identity)
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "TreeNode" RESTART IDENTITY CASCADE;'
  );

  nextId = 1;
  rows = [];

  for (let r = 1; r <= config.roots; r++) {
    const depth =
      config.minDepth +
      Math.floor(Math.random() * (config.maxDepth - config.minDepth + 1));

    createSubtree(null, [r], 1, depth, config.branchingFactor);
  }

  await prisma.treeNode.createMany({
    data: rows,
  });

  console.log(`Inserted ${rows.length} nodes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
