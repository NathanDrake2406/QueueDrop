# QueueDrop

[![CI](https://github.com/NathanDrake2406/QueueDrop/actions/workflows/ci.yml/badge.svg)](https://github.com/NathanDrake2406/QueueDrop/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/NathanDrake2406/QueueDrop/graph/badge.svg)](https://codecov.io/gh/NathanDrake2406/QueueDrop)
![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)

Real-time queue management system for walk-in businesses. Customers join remotely via QR code, track their position live, and get push notifications when called.

## 🎮 [Try the Live Demo →](https://client-ten-indol-52.vercel.app/demo)

Click "Call Next" and watch both panels update in real-time via WebSockets!

---

## Features

- **Interactive split-screen demo** — See staff and customer views side-by-side with real-time SignalR updates
- **Multi-queue support** — Businesses can run multiple concurrent queues (Dine-in, Takeout, Bar)
- **Real-time updates** — SignalR WebSockets push position changes instantly
- **Push notifications** — Web Push API alerts customers even with browser closed
- **QR code generation** — Download QR codes for customers to scan and join
- **Near-front alerts** — Notify customers when they're almost up
- **Mobile-first PWA** — Installable, works offline, no app store needed
- **Staff dashboard** — One-click actions: call next, mark served, remove, no-show
- **Magic link auth** — Passwordless authentication for staff

## Tech Stack

| Layer         | Technology                                      |
| ------------- | ----------------------------------------------- |
| **Backend**   | .NET 8 Minimal API, Vertical Slice Architecture |
| **Database**  | PostgreSQL 16 with EF Core                      |
| **Real-time** | SignalR (WebSockets with fallback)              |
| **Frontend**  | React 19, TypeScript (strict), Tailwind CSS v4  |
| **Testing**   | xUnit, Vitest, Testing Library, Playwright E2E  |
| **CI/CD**     | GitHub Actions, Playwright E2E, Codecov         |

## Architecture

```
src/
├── QueueDrop.Domain/           # Entities, value objects, Result<T>
├── QueueDrop.Infrastructure/   # EF Core, SignalR, Web Push
├── QueueDrop.Api/              # Vertical slices (handler + DTOs per feature)
└── client/                     # React SPA
```

**Key patterns:**

- Queue as Aggregate Root — all mutations through domain methods
- Result<T> for explicit error handling, no exceptions for control flow
- Token-based customer identity — unique URLs, no auth required for customers
- Vertical slices — each feature self-contained in one file

[Architecture Decision Records →](docs/adr/001-architecture-decisions.md)

## Quick Start

```bash
# Prerequisites: .NET 8 SDK, Node.js 20+, Docker

# Start PostgreSQL
docker-compose up -d

# Backend (Terminal 1)
cd src/QueueDrop.Api && dotnet run

# Frontend (Terminal 2)
cd src/client && npm install && npm run dev
```

Open http://localhost:5173

### Demo

| URL                                  | Description                               |
| ------------------------------------ | ----------------------------------------- |
| http://localhost:5173/demo           | **Interactive demo** (staff + customer)   |
| http://localhost:5173/staff/demo-shop| Staff dashboard                           |
| http://localhost:5173/join/demo-shop | Customer queue join                       |

## API

### Customer Endpoints

```
POST /api/join/{businessSlug}              # Join (single queue)
POST /api/join/{businessSlug}/{queueSlug}  # Join specific queue
GET  /api/business/{businessSlug}/queues   # List queues
GET  /api/q/{token}                        # Get position
```

### Staff Endpoints

```
GET    /api/queues/{id}/customers                    # List customers
POST   /api/queues/{id}/call-next                    # Call next
POST   /api/queues/{id}/customers/{id}/serve         # Mark served
POST   /api/queues/{id}/customers/{id}/no-show       # Mark no-show
DELETE /api/queues/{id}/customers/{id}               # Remove
```

### SignalR Events

| Event             | Payload                       | Description               |
| ----------------- | ----------------------------- | ------------------------- |
| `PositionChanged` | `int newPosition`             | Customer position updated |
| `YouAreCalled`    | `string? message`             | Customer has been called  |
| `NearFront`       | `int position`                | Customer almost up        |
| `QueueUpdated`    | `string queueId, string type` | Queue state changed       |

## Testing

```bash
# Backend tests (124 tests)
dotnet test src/QueueDrop.sln

# Frontend unit tests (52 tests)
cd src/client && npm test

# E2E tests (Playwright)
cd src/client && npm run test:e2e

# With coverage
dotnet test src/QueueDrop.sln --collect:"XPlat Code Coverage"
cd src/client && npm run test:coverage
```

## Load Testing

Benchmarked SignalR WebSocket scalability and HTTP API performance.

| Metric                                           | Result |
| ------------------------------------------------ | ------ |
| **Concurrent WebSocket Connections**             | 500    |
| **Connection Success Rate**                      | 100%   |
| **Avg Connection Latency**                       | 1.28ms |
| **P95 Latency**                                  | 2ms    |
| **HTTP Requests/sec**                            | 30+    |
| **Zero reconnections** during 60s sustained load |

```bash
# Run load tests
cd loadtest && npm install
npm run test:signalr:quick # 50 connections
npm run test:http:quick    # 20 concurrent users
```

[Full load test results →](loadtest/results/LOAD_TEST_RESULTS.md)

## Deployment

Deploy with Vercel (frontend) + Railway (backend + PostgreSQL).

```bash
# Backend: Railway auto-deploys from Dockerfile
# Frontend: Vercel auto-deploys from src/client

# Required env vars on Railway:
# - ConnectionStrings__DefaultConnection (auto-set by Railway PostgreSQL)
# - Cors__AllowedOrigins__0=https://your-app.vercel.app
```

[Full deployment guide →](docs/DEPLOYMENT.md)

## Roadmap

- [x] Multi-queue support per business
- [x] Live demo deployment
- [x] Staff authentication (magic links)
- [x] Near-front alerts
- [x] QR code generation
- [x] Interactive split-screen demo
- [ ] SMS notifications (Twilio)
- [ ] Wait time predictions (ML-based)

## License

MIT
