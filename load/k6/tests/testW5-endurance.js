import { check } from "k6";
import { Counter } from "k6/metrics";

import {
  buildK6Options,
  expectCreatedTreeNodeResponse,
  loadTestConfig,
  postTreeNode,
} from "../lib/index.js";

import {
  countDirectChildrenWithPrefix,
  fetchTreeOrThrow,
  findDuplicateIds,
  findRootByLabel,
  getAllIdsAndNodes,
  makeLabelPrefix,
  makeRunId,
  makeUniqueLabel,
} from "./_write-common.js";

const config = loadTestConfig();
export const options = buildK6Options(config);

const postTreeSuccess = new Counter("post_tree_success");
const postTree4xx = new Counter("post_tree_4xx");
const postTree5xx = new Counter("post_tree_5xx");

export function setup() {
  const runId = makeRunId("write");
  const labelPrefix = makeLabelPrefix(runId, "W5");

  const parentCount = Number(config.parentCount || 20);
  const parentIds = [];

  for (let i = 0; i < parentCount; i++) {
    const rootLabel = `${labelPrefix}root-${i}`;
    const res = postTreeNode({ label: rootLabel, parentId: null });
    const root = expectCreatedTreeNodeResponse(res, {
      label: rootLabel,
      parentId: null,
    });
    parentIds.push(root.id);
  }

  return { runId, labelPrefix, parentIds };
}

export default function (data) {
  const parentId = data.parentIds[(__VU - 1) % data.parentIds.length];
  const label = makeUniqueLabel(data.labelPrefix, __VU, __ITER);
  const res = postTreeNode({ label, parentId });

  check(res, {
    "POST status is 201": (r) => r.status === 201,
  });

  if (res.status >= 500) postTree5xx.add(1);
  else if (res.status >= 400) postTree4xx.add(1);
  else if (res.status === 201) postTreeSuccess.add(1);

  if (res.status === 201) {
    expectCreatedTreeNodeResponse(res, { label, parentId });
  }
}

export function handleSummary(summary) {
  const metrics = summary?.metrics || {};

  const runId = makeRunId("write");
  const labelPrefix = makeLabelPrefix(runId, "W5");
  const parentCount = Number(config.parentCount || 20);
  const parentLabels = Array.from(
    { length: parentCount },
    (_, i) => `${labelPrefix}root-${i}`
  );

  let tree = null;
  let error = null;
  try {
    tree = fetchTreeOrThrow();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const createdUnderParents = {};
  const parentsFound = [];

  for (const label of parentLabels) {
    const parent = tree ? findRootByLabel(tree, label) : null;
    if (parent) parentsFound.push(label);
    createdUnderParents[label] = parent
      ? countDirectChildrenWithPrefix(parent, labelPrefix)
      : 0;
  }

  const { ids } = tree ? getAllIdsAndNodes(tree) : { ids: [] };
  const duplicateIds = findDuplicateIds(ids);

  const correctness = {
    testId: "W5",
    runId,
    labelPrefix,
    parentCount,
    parentLabels,
    parentsFound,
    createdUnderParents,
    duplicateIds,
    ok:
      parentsFound.length === parentLabels.length &&
      duplicateIds.length === 0 &&
      error == null,
    error,
  };

  const report = {
    ...correctness,
    metrics: {
      post_tree_success: metrics.post_tree_success?.values ?? null,
      post_tree_4xx: metrics.post_tree_4xx?.values ?? null,
      post_tree_5xx: metrics.post_tree_5xx?.values ?? null,
      http_req_failed: metrics.http_req_failed?.values ?? null,
      http_req_duration: metrics.http_req_duration?.values ?? null,
      checks: metrics.checks?.values ?? null,
    },
  };

  const fileName = `/scripts/results/${report.testId}-${report.runId}.correctness.json`;

  return {
    stdout: JSON.stringify(report, null, 2),
    [fileName]: JSON.stringify(report, null, 2),
  };
}
