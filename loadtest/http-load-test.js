import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const joinQueueSuccess = new Rate("join_queue_success");
const getPositionSuccess = new Rate("get_position_success");
const joinQueueDuration = new Trend("join_queue_duration");

// Test configuration
export const options = {
  scenarios: {
    // Ramp up to simulate realistic traffic
    load_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 }, // Ramp up to 50 users
        { duration: "1m", target: 50 }, // Stay at 50 users
        { duration: "30s", target: 100 }, // Ramp up to 100 users
        { duration: "1m", target: 100 }, // Stay at 100 users
        { duration: "30s", target: 0 }, // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    join_queue_success: ["rate>0.95"], // 95% success rate
    get_position_success: ["rate>0.95"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;

  // 1. Join the queue
  const joinPayload = JSON.stringify({
    name: `LoadTest User ${uniqueId}`,
  });

  const joinRes = http.post(`${BASE_URL}/api/join/demo-shop/main-queue`, joinPayload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "JoinQueue" },
  });

  const joinSuccess = check(joinRes, {
    "join queue status is 2xx": (r) => r.status >= 200 && r.status < 300,
    "join queue returns token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token && body.token.length > 0;
      } catch {
        return false;
      }
    },
  });

  joinQueueSuccess.add(joinSuccess);
  joinQueueDuration.add(joinRes.timings.duration);

  if (!joinSuccess) {
    console.error(`Join failed: ${joinRes.status} - ${joinRes.body}`);
    sleep(1);
    return;
  }

  const token = JSON.parse(joinRes.body).token;

  // 2. Get position (simulates polling while waiting)
  for (let i = 0; i < 3; i++) {
    sleep(0.5); // Wait between polls

    const positionRes = http.get(`${BASE_URL}/api/q/${token}`, {
      tags: { name: "GetPosition" },
    });

    const positionSuccess = check(positionRes, {
      "get position status is 200": (r) => r.status === 200,
      "get position returns data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.position !== undefined;
        } catch {
          return false;
        }
      },
    });

    getPositionSuccess.add(positionSuccess);
  }

  sleep(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration_seconds: data.state.testRunDurationMs / 1000,
    vus_max: data.metrics.vus_max?.values?.max || 0,
    requests_total: data.metrics.http_reqs?.values?.count || 0,
    requests_per_second: data.metrics.http_reqs?.values?.rate || 0,

    http_req_duration: {
      avg_ms: (data.metrics.http_req_duration?.values?.avg || 0).toFixed(2),
      p50_ms: (data.metrics.http_req_duration?.values?.["p(50)"] || 0).toFixed(2),
      p95_ms: (data.metrics.http_req_duration?.values?.["p(95)"] || 0).toFixed(2),
      p99_ms: (data.metrics.http_req_duration?.values?.["p(99)"] || 0).toFixed(2),
    },

    join_queue: {
      success_rate: ((data.metrics.join_queue_success?.values?.rate || 0) * 100).toFixed(2) + "%",
      avg_duration_ms: (data.metrics.join_queue_duration?.values?.avg || 0).toFixed(2),
    },

    get_position: {
      success_rate: ((data.metrics.get_position_success?.values?.rate || 0) * 100).toFixed(2) + "%",
    },

    passed: !data.root_group.checks.some((c) => c.fails > 0),
  };

  return {
    "loadtest/results/http-summary.json": JSON.stringify(summary, null, 2),
    stdout: textSummary(summary),
  };
}

function textSummary(summary) {
  return `
╔══════════════════════════════════════════════════════════════╗
║                    HTTP LOAD TEST RESULTS                    ║
╠══════════════════════════════════════════════════════════════╣
║  Duration:        ${summary.duration_seconds.toFixed(0).padStart(6)}s                                   ║
║  Max VUs:         ${String(summary.vus_max).padStart(6)}                                     ║
║  Total Requests:  ${String(summary.requests_total).padStart(6)}                                     ║
║  Requests/sec:    ${summary.requests_per_second.toFixed(2).padStart(6)}                                     ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP Response Times                                         ║
║    Average:       ${summary.http_req_duration.avg_ms.padStart(6)} ms                                  ║
║    P50:           ${summary.http_req_duration.p50_ms.padStart(6)} ms                                  ║
║    P95:           ${summary.http_req_duration.p95_ms.padStart(6)} ms                                  ║
║    P99:           ${summary.http_req_duration.p99_ms.padStart(6)} ms                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Join Queue:      ${summary.join_queue.success_rate.padStart(7)} success                            ║
║  Get Position:    ${summary.get_position.success_rate.padStart(7)} success                            ║
╠══════════════════════════════════════════════════════════════╣
║  Result:          ${summary.passed ? "✓ PASSED" : "✗ FAILED"}                                       ║
╚══════════════════════════════════════════════════════════════╝
`;
}
