# QueueDrop Load Testing

Performance testing suite for QueueDrop's HTTP API and SignalR real-time connections.

## Prerequisites

- Node.js 18+
- [k6](https://k6.io/docs/getting-started/installation/) for HTTP load testing
- Running QueueDrop server (`dotnet run` from `src/QueueDrop.Api`)

## Setup

```bash
cd loadtest
npm install
```

## Running Tests

### Quick Tests (30 seconds, lower load)

```bash
# HTTP API (20 concurrent users)
npm run test:http:quick

# SignalR (50 concurrent connections)
npm run test:signalr:quick
```

### Full Tests (3+ minutes, higher load)

```bash
# HTTP API - ramps up to 100 concurrent users
npm run test:http

# SignalR - 100 concurrent WebSocket connections
npm run test:signalr

# Run both
npm run test:all
```

### Custom Configuration

**HTTP Load Test:**

```bash
k6 run --vus 200 --duration 5m http-load-test.js
k6 run -e BASE_URL=https://your-server.com http-load-test.js
```

**SignalR Load Test:**

```bash
node signalr-load-test.js --connections=500 --duration=120 --ramp-up=30
node signalr-load-test.js --url=https://your-server.com
```

## Test Scenarios

### HTTP Load Test (`http-load-test.js`)

Tests the REST API under load:

1. **Join Queue** - `POST /api/join/demo-shop/main-queue`
2. **Get Position** - `GET /api/position/{token}` (3x per user)

**Metrics tracked:**

- Request duration (avg, p50, p95, p99)
- Success rate per endpoint
- Requests per second

**Pass criteria:**

- 95th percentile response time < 500ms
- 95%+ success rate

### SignalR Load Test (`signalr-load-test.js`)

Tests WebSocket connection scalability:

1. Join queue via HTTP to get token
2. Connect to SignalR hub with token
3. Hold connection for test duration
4. Track reconnections and message delivery

**Metrics tracked:**

- Connection latency (avg, p50, p95, p99)
- Connection success rate
- Messages received
- Reconnection count

**Pass criteria:**

- 95%+ connection success rate

## Results

Results are saved to `loadtest/results/`:

- `http-summary.json` - HTTP test results
- `signalr-summary.json` - SignalR test results

## Interpreting Results

### Good Results

```
HTTP p95 < 100ms, success rate > 99%
SignalR 100 connections with 0 failures, <50ms avg latency
```

### Warning Signs

```
HTTP p95 > 500ms - Server under heavy load
SignalR reconnections > 0 - Connection stability issues
Success rate < 95% - Server rejecting requests
```

## Scaling Recommendations

Based on load test results:

| Connections | Recommended Setup                                    |
| ----------- | ---------------------------------------------------- |
| < 100       | Single server, default config                        |
| 100-500     | Increase connection limits, consider Redis backplane |
| 500+        | Multiple servers with Redis backplane for SignalR    |

## CI Integration

```yaml
# Example GitHub Actions step
- name: Run load tests
  run: |
    cd loadtest
    npm install
    npm run test:http:quick
    npm run test:signalr:quick
```
