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

const SEED = process.env.SEED ? Number.parseInt(process.env.SEED, 10) : null;

const MAX_NODES = process.env.MAX_NODES
  ? Number.parseInt(process.env.MAX_NODES, 10)
  : null;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = SEED == null ? Math.random : mulberry32(SEED);

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
      Math.floor(random() * (config.maxDepth - config.minDepth + 1));

    createSubtree(null, [r], 1, depth, config.branchingFactor);
  }

  await prisma.treeNode.createMany({
    data: rows,
  });

  // createMany() inserts explicit IDs, which does not advance the Postgres sequence.
  // Reset the sequence so subsequent inserts (without explicit IDs) don't collide.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"TreeNode"','id'), (SELECT COALESCE(MAX(id), 1) FROM "TreeNode"), true);`
  );

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
