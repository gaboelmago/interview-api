function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

// Safe-by-default operational caps for GET /api/tree.
// These are intentionally conservative but high enough to not interfere with
// the included seed presets under normal usage.
const DEFAULT_TREE_GET_MAX_NODES = 100_000;
const DEFAULT_TREE_GET_MAX_DEPTH = 100;

export type TreeGetLimits = {
  maxNodes?: number;
  maxDepth?: number;
};

export function getTreeGetLimits(): TreeGetLimits {
  return {
    maxNodes:
      parsePositiveInt(process.env.TREE_GET_MAX_NODES) ??
      DEFAULT_TREE_GET_MAX_NODES,
    maxDepth:
      parsePositiveInt(process.env.TREE_GET_MAX_DEPTH) ??
      DEFAULT_TREE_GET_MAX_DEPTH,
  };
}
