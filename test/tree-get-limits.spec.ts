import { getTreeGetLimits } from "../src/config/tree-get-limits";

describe("getTreeGetLimits", () => {
  it("uses safe defaults when env vars are unset/blank", () => {
    const prevNodes = process.env.TREE_GET_MAX_NODES;
    const prevDepth = process.env.TREE_GET_MAX_DEPTH;

    try {
      delete process.env.TREE_GET_MAX_NODES;
      delete process.env.TREE_GET_MAX_DEPTH;

      const limitsUnset = getTreeGetLimits();
      expect(limitsUnset.maxNodes).toBe(100_000);
      expect(limitsUnset.maxDepth).toBe(100);

      process.env.TREE_GET_MAX_NODES = "";
      process.env.TREE_GET_MAX_DEPTH = "   ";

      const limitsBlank = getTreeGetLimits();
      expect(limitsBlank.maxNodes).toBe(100_000);
      expect(limitsBlank.maxDepth).toBe(100);
    } finally {
      if (prevNodes === undefined) delete process.env.TREE_GET_MAX_NODES;
      else process.env.TREE_GET_MAX_NODES = prevNodes;

      if (prevDepth === undefined) delete process.env.TREE_GET_MAX_DEPTH;
      else process.env.TREE_GET_MAX_DEPTH = prevDepth;
    }
  });

  it("uses explicit env overrides when valid", () => {
    const prevNodes = process.env.TREE_GET_MAX_NODES;
    const prevDepth = process.env.TREE_GET_MAX_DEPTH;

    try {
      process.env.TREE_GET_MAX_NODES = "123";
      process.env.TREE_GET_MAX_DEPTH = "45";

      const limits = getTreeGetLimits();
      expect(limits.maxNodes).toBe(123);
      expect(limits.maxDepth).toBe(45);
    } finally {
      if (prevNodes === undefined) delete process.env.TREE_GET_MAX_NODES;
      else process.env.TREE_GET_MAX_NODES = prevNodes;

      if (prevDepth === undefined) delete process.env.TREE_GET_MAX_DEPTH;
      else process.env.TREE_GET_MAX_DEPTH = prevDepth;
    }
  });

  it("falls back to defaults when env values are invalid", () => {
    const prevNodes = process.env.TREE_GET_MAX_NODES;
    const prevDepth = process.env.TREE_GET_MAX_DEPTH;

    try {
      process.env.TREE_GET_MAX_NODES = "-1";
      process.env.TREE_GET_MAX_DEPTH = "nope";

      const limits = getTreeGetLimits();
      expect(limits.maxNodes).toBe(100_000);
      expect(limits.maxDepth).toBe(100);
    } finally {
      if (prevNodes === undefined) delete process.env.TREE_GET_MAX_NODES;
      else process.env.TREE_GET_MAX_NODES = prevNodes;

      if (prevDepth === undefined) delete process.env.TREE_GET_MAX_DEPTH;
      else process.env.TREE_GET_MAX_DEPTH = prevDepth;
    }
  });
});
