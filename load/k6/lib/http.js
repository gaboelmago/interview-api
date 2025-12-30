import http from "k6/http";
import { check } from "k6";

/* global __ENV */

export function getBaseUrl() {
  return __ENV.BASE_URL || "http://localhost:3000";
}

export function getTreeOnce({ expectNonEmpty = false } = {}) {
  const baseUrl = getBaseUrl();
  const res = http.get(`${baseUrl}/api/tree`, {
    tags: { name: "GET /api/tree" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200 but got ${res.status}`);
  }

  let parsed;
  try {
    parsed = res.json();
  } catch {
    throw new Error("Response was not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected response body to be a JSON array");
  }

  if (expectNonEmpty && parsed.length === 0) {
    throw new Error("Expected non-empty tree array but got []");
  }

  return parsed;
}

export function getTreeFast() {
  const baseUrl = getBaseUrl();
  return http.get(`${baseUrl}/api/tree`, { tags: { name: "GET /api/tree" } });
}

export function postTreeNode({ label, parentId }) {
  const baseUrl = getBaseUrl();

  const payload = JSON.stringify({
    label,
    ...(parentId == null ? {} : { parentId }),
  });

  return http.post(`${baseUrl}/api/tree`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "POST /api/tree" },
  });
}

export function parseJsonOrThrow(res) {
  try {
    return res.json();
  } catch {
    throw new Error("Response was not valid JSON");
  }
}

export function expectCreatedTreeNodeResponse(res, { label, parentId }) {
  check(res, {
    "status is 201": (r) => r.status === 201,
  });

  if (res.status !== 201) {
    throw new Error(`Expected 201 but got ${res.status}`);
  }

  const body = parseJsonOrThrow(res);
  if (!body || typeof body !== "object") {
    throw new Error("Expected JSON object response");
  }

  if (typeof body.id !== "number") {
    throw new Error("Expected response.id to be a number");
  }

  if (body.label !== label) {
    throw new Error(`Expected response.label to be '${label}'`);
  }

  const expectedParentId = parentId == null ? null : parentId;
  if (body.parentId !== expectedParentId) {
    throw new Error(
      `Expected response.parentId to be ${expectedParentId} but got ${body.parentId}`
    );
  }

  return body;
}
