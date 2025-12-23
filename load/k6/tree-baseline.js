import http from "k6/http";
import { check } from "k6";

/* global __ENV */
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const VUS = Number(__ENV.VUS || 25);
const DURATION = __ENV.DURATION || "1m";

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/tree`, {
    tags: { name: "GET /api/tree" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
