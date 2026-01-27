#!/usr/bin/env node

/**
 * SignalR Connection Load Test
 * Tests concurrent WebSocket connections to the QueueHub
 *
 * Usage: node signalr-load-test.js [options]
 *   --connections=100    Number of concurrent connections
 *   --duration=60        Test duration in seconds
 *   --ramp-up=10         Ramp-up time in seconds
 *   --url=http://...     Server URL
 */

const signalR = require("@microsoft/signalr");

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace("--", "").split("=");
  acc[key] = value;
  return acc;
}, {});

const CONFIG = {
  connections: parseInt(args.connections || "100"),
  duration: parseInt(args.duration || "60"),
  rampUp: parseInt(args["ramp-up"] || "10"),
  baseUrl: args.url || "http://localhost:5000",
};

// Metrics
const metrics = {
  connectionsAttempted: 0,
  connectionsSucceeded: 0,
  connectionsFailed: 0,
  messagesReceived: 0,
  reconnections: 0,
  errors: [],
  latencies: [],
  startTime: null,
  endTime: null,
};

const connections = [];

async function joinQueueAndGetToken(index) {
  const response = await fetch(`${CONFIG.baseUrl}/api/join/demo-shop/main-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `SignalR Test User ${index}` }),
  });

  if (!response.ok) {
    throw new Error(`Failed to join queue: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

async function createConnection(index) {
  metrics.connectionsAttempted++;

  try {
    // First join the queue to get a valid token
    const token = await joinQueueAndGetToken(index);

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${CONFIG.baseUrl}/hubs/queue?token=${token}`)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          metrics.reconnections++;
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        },
      })
      .configureLogging(signalR.LogLevel.Error)
      .build();

    // Track message receipt
    connection.on("PositionUpdate", () => {
      metrics.messagesReceived++;
    });

    connection.on("CustomerCalled", () => {
      metrics.messagesReceived++;
    });

    connection.onreconnecting(() => {
      metrics.reconnections++;
    });

    const connectStart = Date.now();
    await connection.start();
    const connectLatency = Date.now() - connectStart;

    metrics.latencies.push(connectLatency);
    metrics.connectionsSucceeded++;

    connections.push({ connection, token, index });

    return true;
  } catch (error) {
    metrics.connectionsFailed++;
    metrics.errors.push({ index, error: error.message });
    return false;
  }
}

async function rampUpConnections() {
  const delayBetweenConnections = (CONFIG.rampUp * 1000) / CONFIG.connections;

  console.log(`\nRamping up ${CONFIG.connections} connections over ${CONFIG.rampUp}s...`);

  for (let i = 0; i < CONFIG.connections; i++) {
    createConnection(i); // Don't await - parallel connections
    await sleep(delayBetweenConnections);

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Connections: ${i + 1}/${CONFIG.connections}`);
    }
  }

  console.log(`\r  Connections: ${CONFIG.connections}/${CONFIG.connections} - Ramp-up complete`);
}

async function holdConnections() {
  const holdDuration = CONFIG.duration - CONFIG.rampUp;
  console.log(`\nHolding ${connections.length} connections for ${holdDuration}s...`);

  const startConnections = metrics.connectionsSucceeded;
  const startMessages = metrics.messagesReceived;
  const startTime = Date.now();

  // Log stats every 10 seconds
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const currentConnections = connections.filter(
      (c) => c.connection.state === signalR.HubConnectionState.Connected,
    ).length;
    console.log(
      `  [${elapsed}s] Active: ${currentConnections}, Messages: ${metrics.messagesReceived - startMessages}, Reconnects: ${metrics.reconnections}`,
    );
  }, 10000);

  await sleep(holdDuration * 1000);
  clearInterval(interval);
}

async function closeAllConnections() {
  console.log(`\nClosing ${connections.length} connections...`);

  await Promise.all(
    connections.map(async ({ connection }) => {
      try {
        await connection.stop();
      } catch {
        // Ignore close errors
      }
    }),
  );
}

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function printResults() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const avgLatency =
    metrics.latencies.length > 0 ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length : 0;

  const results = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    duration_seconds: duration.toFixed(2),
    connections: {
      attempted: metrics.connectionsAttempted,
      succeeded: metrics.connectionsSucceeded,
      failed: metrics.connectionsFailed,
      success_rate: ((metrics.connectionsSucceeded / metrics.connectionsAttempted) * 100).toFixed(2) + "%",
    },
    latency_ms: {
      avg: avgLatency.toFixed(2),
      p50: calculatePercentile(metrics.latencies, 50).toFixed(2),
      p95: calculatePercentile(metrics.latencies, 95).toFixed(2),
      p99: calculatePercentile(metrics.latencies, 99).toFixed(2),
      max: Math.max(...metrics.latencies, 0).toFixed(2),
    },
    messages_received: metrics.messagesReceived,
    reconnections: metrics.reconnections,
    errors: metrics.errors.slice(0, 5), // First 5 errors only
    passed: metrics.connectionsSucceeded >= CONFIG.connections * 0.95,
  };

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 SIGNALR LOAD TEST RESULTS                    ║
╠══════════════════════════════════════════════════════════════╣
║  Target Connections:  ${String(CONFIG.connections).padStart(6)}                                ║
║  Test Duration:       ${String(CONFIG.duration).padStart(6)}s                               ║
╠══════════════════════════════════════════════════════════════╣
║  Connections                                                 ║
║    Attempted:         ${String(results.connections.attempted).padStart(6)}                                ║
║    Succeeded:         ${String(results.connections.succeeded).padStart(6)}                                ║
║    Failed:            ${String(results.connections.failed).padStart(6)}                                ║
║    Success Rate:      ${results.connections.success_rate.padStart(7)}                               ║
╠══════════════════════════════════════════════════════════════╣
║  Connection Latency                                          ║
║    Average:           ${results.latency_ms.avg.padStart(6)} ms                              ║
║    P50:               ${results.latency_ms.p50.padStart(6)} ms                              ║
║    P95:               ${results.latency_ms.p95.padStart(6)} ms                              ║
║    P99:               ${results.latency_ms.p99.padStart(6)} ms                              ║
╠══════════════════════════════════════════════════════════════╣
║  Messages Received:   ${String(results.messages_received).padStart(6)}                                ║
║  Reconnections:       ${String(results.reconnections).padStart(6)}                                ║
╠══════════════════════════════════════════════════════════════╣
║  Result:              ${results.passed ? "✓ PASSED" : "✗ FAILED"}                                   ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Write JSON results
  const fs = require("fs");
  const resultsDir = "./loadtest/results";
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  fs.writeFileSync(`${resultsDir}/signalr-summary.json`, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${resultsDir}/signalr-summary.json`);

  return results.passed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              SignalR Connection Load Test                    ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Server:      ${CONFIG.baseUrl.padEnd(45)}║`);
  console.log(`║  Connections: ${String(CONFIG.connections).padEnd(45)}║`);
  console.log(`║  Duration:    ${(CONFIG.duration + "s").padEnd(45)}║`);
  console.log(`║  Ramp-up:     ${(CONFIG.rampUp + "s").padEnd(45)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");

  metrics.startTime = Date.now();

  try {
    await rampUpConnections();
    await holdConnections();
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await closeAllConnections();
    metrics.endTime = Date.now();
    const passed = printResults();
    process.exit(passed ? 0 : 1);
  }
}

main();
