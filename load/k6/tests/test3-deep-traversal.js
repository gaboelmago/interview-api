import { check } from "k6";

import {
  buildK6Options,
  getTreeFast,
  getTreeOnce,
  loadTestConfig,
} from "../lib/index.js";

const config = loadTestConfig();
export const options = buildK6Options(config);

export function setup() {
  getTreeOnce({ expectNonEmpty: config.expectNonEmpty });
}

export default function () {
  const res = getTreeFast();
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
