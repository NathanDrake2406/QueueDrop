# QueueDrop

<p align="center">
  <img src="docs/images/logo.svg" alt="QueueDrop Logo" width="120" />
</p>

<p align="center">
  <strong>Smart queue management for modern businesses</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

QueueDrop eliminates wait time frustration by letting customers join queues remotely and receive real-time notifications when it's their turn. Perfect for restaurants, barbershops, clinics, and any business with walk-in customers.

### The Problem

- Customers hate waiting in physical lines
- Businesses lose customers who leave due to long waits
- Staff waste time managing paper waitlists
- No visibility into expected wait times

### The Solution

QueueDrop provides a modern, mobile-first queue management system:

- **Customers** scan a QR code or visit a link to join the queue from anywhere
- **Real-time updates** show their position as it changes
- **Push notifications** alert them when called (even with the app closed)
- **Staff dashboard** provides full queue visibility and one-click management

## Features

### For Customers

- 📱 **Mobile-first design** - Join queues from any device
- 🔔 **Push notifications** - Get alerted when it's your turn
- 📍 **Live position tracking** - See your spot update in real-time
- 🚫 **No app required** - Works in any modern browser

### For Staff

- 📊 **Real-time dashboard** - See all customers at a glance
- 🗂️ **Multi-queue support** - Manage multiple queues per business (Dine-in, Takeout, Bar)
- ⚡ **One-click actions** - Call next, mark served, remove
- 📈 **Queue analytics** - Track wait times and throughput
- 🔗 **QR code generation** - Easy customer onboarding per queue

### Technical Highlights

- ⚡ **Real-time updates** via SignalR WebSockets
- 📲 **PWA support** - Installable on mobile devices
- 🔒 **Offline capable** - Service worker caching
- 🎯 **Type-safe** - Full TypeScript frontend and backend

## Demo

**Live Demo:** [Coming Soon]

### Screenshots

<table>
  <tr>
    <td><img src="docs/images/customer-join.png" alt="Customer Join" /></td>
    <td><img src="docs/images/queue-position.png" alt="Queue Position" /></td>
    <td><img src="docs/images/staff-dashboard.png" alt="Staff Dashboard" /></td>
  </tr>
  <tr>
    <td align="center"><em>Join Queue</em></td>
    <td align="center"><em>Track Position</em></td>
    <td align="center"><em>Staff Dashboard</em></td>
  </tr>
</table>

## Tech Stack

### Backend

- **.NET 8** - Minimal API with vertical slice architecture
- **PostgreSQL** - Primary database with EF Core
- **SignalR** - Real-time WebSocket communication
- **Web Push** - Browser push notifications (VAPID)

### Frontend

- **React 19** - UI with hooks and functional components
- **TypeScript** - Strict type checking
- **Tailwind CSS v4** - Utility-first styling
- **Vite** - Fast build tooling

### Infrastructure

- **Docker Compose** - Local development environment
- **GitHub Actions** - CI/CD pipeline

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/queuedrop.git
cd queuedrop

# Start PostgreSQL
docker-compose up -d

# Start the backend (Terminal 1)
cd src/QueueDrop.Api
dotnet run

# Start the frontend (Terminal 2)
cd src/client
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Demo Data

The app seeds a demo business (`demo-shop`) with multiple queues on startup:

- **Main Queue** - General service queue
- **Takeout** - Pickup orders queue
- **Bar** - Bar service queue

Try these URLs:

- **Staff Dashboard:** http://localhost:5173/staff/demo-shop
- **Customer Join:** http://localhost:5173/join/demo-shop
- **Join Specific Queue:** http://localhost:5173/join/demo-shop/takeout

## Architecture

### Domain-Driven Design

```
src/
├── QueueDrop.Domain/        # Core domain entities and logic
│   ├── Entities/            # Queue, QueueCustomer, Business
│   ├── Enums/               # CustomerStatus, QueueUpdateType
│   └── Common/              # Result<T>, Error types
│
├── QueueDrop.Infrastructure/
│   ├── Persistence/         # EF Core DbContext
│   ├── SignalR/             # Real-time notifications
│   └── PushNotifications/   # Web Push service
│
├── QueueDrop.Api/
│   ├── Features/            # Vertical slices (handler + DTOs)
│   │   ├── Customers/       # JoinQueue, GetPosition
│   │   └── Queues/          # CallNext, MarkServed, etc.
│   └── BackgroundServices/  # Auto no-show worker
│
└── client/                  # React frontend
    └── src/
        ├── features/        # Customer and Staff features
        └── shared/          # Hooks, utils, components
```

### Key Design Decisions

1. **Vertical Slices** - Each feature is self-contained (handler + DTOs + validation)
2. **Queue as Aggregate Root** - All mutations go through Queue entity methods
3. **Result<T> Pattern** - Explicit error handling, no exceptions for control flow
4. **Token-based Identity** - Customers identified by unique URL tokens

## API Reference

### Customer Endpoints

| Method | Endpoint                               | Description                        |
| ------ | -------------------------------------- | ---------------------------------- |
| POST   | `/api/join/{businessSlug}`             | Join queue (single queue business) |
| POST   | `/api/join/{businessSlug}/{queueSlug}` | Join specific queue                |
| GET    | `/api/business/{businessSlug}/queues`  | List all queues for a business     |
| GET    | `/api/q/{token}`                       | Get position                       |
| POST   | `/api/q/{token}/push-subscription`     | Save push subscription             |

### Staff Endpoints

| Method | Endpoint                                          | Description        |
| ------ | ------------------------------------------------- | ------------------ |
| GET    | `/api/queues/{id}/customers`                      | List all customers |
| POST   | `/api/queues/{id}/call-next`                      | Call next customer |
| POST   | `/api/queues/{id}/customers/{customerId}/serve`   | Mark served        |
| POST   | `/api/queues/{id}/customers/{customerId}/no-show` | Mark no-show       |
| DELETE | `/api/queues/{id}/customers/{customerId}`         | Remove customer    |

### SignalR Events

| Event             | Direction       | Description               |
| ----------------- | --------------- | ------------------------- |
| `PositionChanged` | Server → Client | Customer position updated |
| `YouAreCalled`    | Server → Client | Customer has been called  |
| `QueueUpdated`    | Server → Client | Queue state changed       |

## Testing

```bash
# Run all backend tests
cd src
dotnet test

# Run frontend E2E tests
cd src/client
npm run test:e2e
```

## Roadmap

- [ ] Staff authentication (Auth0)
- [x] Multi-queue support per business
- [ ] SMS notifications
- [ ] Wait time predictions
- [ ] Analytics dashboard
- [ ] Customer feedback/ratings

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ for the portfolio
</p>
