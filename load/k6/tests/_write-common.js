import http from "k6/http";

import { getBaseUrl, parseJsonOrThrow } from "../lib/http.js";

/* global __ENV */

export function makeRunId(prefix) {
  const envRunId = __ENV?.RUN_ID;
  if (envRunId != null && String(envRunId).trim().length > 0) {
    return `${prefix}-${String(envRunId).trim()}`;
  }
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9);
  return `${prefix}-${ts}-${rand}`;
}

export function makeLabelPrefix(runId, testId) {
  return `k6-${runId}-${testId}-`;
}

export function makeUniqueLabel(labelPrefix, vu, iter) {
  return `${labelPrefix}vu${vu}-iter${iter}`;
}

export function getAllIdsAndNodes(treeArray) {
  const ids = [];
  const nodes = [];

  const stack = Array.isArray(treeArray) ? [...treeArray] : [];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    nodes.push(node);
    if (typeof node.id === "number") ids.push(node.id);
    if (Array.isArray(node.children)) {
      for (let i = 0; i < node.children.length; i++) {
        stack.push(node.children[i]);
      }
    }
  }

  return { ids, nodes };
}

export function findRootById(treeArray, id) {
  if (!Array.isArray(treeArray)) return null;
  for (const root of treeArray) {
    if (root && typeof root === "object" && root.id === id) return root;
  }
  return null;
}

export function findRootByLabel(treeArray, label) {
  if (!Array.isArray(treeArray)) return null;
  for (const root of treeArray) {
    if (root && typeof root === "object" && root.label === label) return root;
  }
  return null;
}

export function countDirectChildrenWithPrefix(parentNode, labelPrefix) {
  if (!parentNode || !Array.isArray(parentNode.children)) return 0;
  let count = 0;
  for (const child of parentNode.children) {
    if (
      child &&
      typeof child.label === "string" &&
      child.label.startsWith(labelPrefix)
    ) {
      count++;
    }
  }
  return count;
}

export function fetchTreeOrThrow() {
  const baseUrl = getBaseUrl();
  const res = http.get(`${baseUrl}/api/tree`, {
    tags: { name: "GET /api/tree" },
  });
  if (res.status !== 200) {
    throw new Error(`Expected 200 from GET /api/tree but got ${res.status}`);
  }
  const parsed = parseJsonOrThrow(res);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected GET /api/tree response to be an array");
  }
  return parsed;
}

export function findDuplicateIds(ids) {
  const seen = new Set();
  const dups = new Set();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    else seen.add(id);
  }
  return Array.from(dups);
}
