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
  const labelPrefix = makeLabelPrefix(runId, "W1");

  // Create a dedicated parent root for this run.
  const rootLabel = `${labelPrefix}root`;
  const res = postTreeNode({ label: rootLabel, parentId: null });
  const root = expectCreatedTreeNodeResponse(res, {
    label: rootLabel,
    parentId: null,
  });

  return { runId, labelPrefix, parentId: root.id };
}

export default function (data) {
  const label = makeUniqueLabel(data.labelPrefix, __VU, __ITER);
  const res = postTreeNode({ label, parentId: data.parentId });

  check(res, {
    "POST status is 201": (r) => r.status === 201,
  });

  if (res.status >= 500) postTree5xx.add(1);
  else if (res.status >= 400) postTree4xx.add(1);
  else if (res.status === 201) postTreeSuccess.add(1);

  if (res.status === 201) {
    // Validate response shape (keeps correctness strict even under low load).
    expectCreatedTreeNodeResponse(res, { label, parentId: data.parentId });
  }
}

export function handleSummary(summary) {
  const metrics = summary?.metrics || {};

  const runId = makeRunId("write");
  const labelPrefix = makeLabelPrefix(runId, "W1");
  const rootLabel = `${labelPrefix}root`;

  let tree = null;
  let error = null;

  try {
    tree = fetchTreeOrThrow();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const parent = tree ? findRootByLabel(tree, rootLabel) : null;
  const createdUnderParent = parent
    ? countDirectChildrenWithPrefix(parent, labelPrefix)
    : 0;

  const { ids } = tree ? getAllIdsAndNodes(tree) : { ids: [] };
  const duplicateIds = findDuplicateIds(ids);

  const correctness = {
    testId: "W1",
    runId,
    rootLabel,
    labelPrefix,
    createdUnderParent,
    duplicateIds,
    ok: Boolean(parent) && duplicateIds.length === 0 && error == null,
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
