# QueueDrop Load Test Results

**Test Date:** January 2026
**Environment:** MacOS, .NET 8, PostgreSQL 16, Single Server

## Summary

| Metric                             | Result |
| ---------------------------------- | ------ |
| **SignalR Concurrent Connections** | 500    |
| **Connection Success Rate**        | 100%   |
| **Avg Connection Latency**         | 1.28ms |
| **P95 Connection Latency**         | 2ms    |
| **Reconnections**                  | 0      |
| **HTTP Requests/sec**              | 30+    |
| **HTTP Avg Response Time**         | 25ms   |

## SignalR WebSocket Test

Tested concurrent WebSocket connections to the real-time queue hub.

```
╔══════════════════════════════════════════════════════════════╗
║                 SIGNALR LOAD TEST RESULTS                    ║
╠══════════════════════════════════════════════════════════════╣
║  Target Connections:     500                                ║
║  Test Duration:           60s                               ║
╠══════════════════════════════════════════════════════════════╣
║  Connections                                                 ║
║    Attempted:            500                                ║
║    Succeeded:            500                                ║
║    Failed:                 0                                ║
║    Success Rate:      100.00%                               ║
╠══════════════════════════════════════════════════════════════╣
║  Connection Latency                                          ║
║    Average:             1.28 ms                              ║
║    P50:                 1.00 ms                              ║
║    P95:                 2.00 ms                              ║
║    P99:                 3.00 ms                              ║
╠══════════════════════════════════════════════════════════════╣
║  Messages Received:        0                                ║
║  Reconnections:            0                                ║
╠══════════════════════════════════════════════════════════════╣
║  Result:              ✓ PASSED                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Key Findings

- Server handles 500 simultaneous WebSocket connections without degradation
- Sub-2ms connection latency at p95
- Zero reconnections during 60-second sustained load
- All connections remained stable throughout the test

## HTTP API Test

Tested REST API endpoints under concurrent load.

```
╔══════════════════════════════════════════════════════════════╗
║                    HTTP LOAD TEST RESULTS                    ║
╠══════════════════════════════════════════════════════════════╣
║  Duration:            31s                                   ║
║  Max VUs:             20                                     ║
║  Total Requests:     960                                     ║
║  Requests/sec:     30.55                                     ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP Response Times                                         ║
║    Average:        24.73 ms                                  ║
║    P95:            66.14 ms                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Join Queue:      100.00% success                            ║
║  Get Position:    100.00% success                            ║
╠══════════════════════════════════════════════════════════════╣
║  Result:          ✓ PASSED                                  ║
╚══════════════════════════════════════════════════════════════╝
```

### Endpoints Tested

| Endpoint                            | Success Rate | Avg Latency |
| ----------------------------------- | ------------ | ----------- |
| `POST /api/join/{business}/{queue}` | 100%         | ~25ms       |
| `GET /api/q/{token}`                | 100%         | ~15ms       |

## Scaling Recommendations

Based on these results:

| Load Level           | Recommendation                            |
| -------------------- | ----------------------------------------- |
| < 500 connections    | Single server, default config             |
| 500-2000 connections | Increase file descriptors, tune Kestrel   |
| 2000+ connections    | Add Redis backplane for SignalR scale-out |

## Reproduce These Tests

```bash
cd loadtest
npm install

# Quick test (50 connections, 30s)
npm run test:signalr:quick

# Full test (500 connections, 60s)
node signalr-load-test.js --connections=500 --duration=60 --ramp-up=20

# HTTP API test
npm run test:http:quick
```
