function parsePositiveInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type TreeGetLimits = {
  maxNodes?: number;
  maxDepth?: number;
};

export function getTreeGetLimits(): TreeGetLimits {
  return {
    maxNodes: parsePositiveInt(process.env.TREE_GET_MAX_NODES),
    maxDepth: parsePositiveInt(process.env.TREE_GET_MAX_DEPTH),
  };
}
