# QueueDrop MVP Design

**Date:** 2026-01-27
**Status:** Approved

## Overview

QueueDrop is a customer waitlist web app for queue management. Customers join a queue via QR code/link, see their live position via SignalR, and receive web push notifications when called. Staff manage queues from a dashboard.

## Key Decisions

| Decision          | Choice                                                   | Rationale                                  |
| ----------------- | -------------------------------------------------------- | ------------------------------------------ |
| Queue scope       | Single queue per business (MVP), model supports multiple | YAGNI — ship simple, expand later          |
| Customer identity | Token-based URL (`/q/{token}`)                           | No accounts, works with push notifications |
| Real-time updates | Position + queue activity                                | Confidence without time estimate liability |
| Staff actions     | Call + grace period                                      | Handles real-world no-shows                |
| Notifications     | Web Push only (no SMS)                                   | No per-message costs, simpler MVP          |
| Push fallback     | Banner + 30s polling                                     | Graceful degradation if push denied        |

---

## Domain Model

### Entities

```
Business (Tenant)
├── Id: Guid
├── Name: string
├── Slug: string (URL-friendly, unique)
└── Queues: List<Queue>

Queue (Aggregate Root)
├── Id: Guid
├── BusinessId: Guid
├── Name: string
├── IsActive: bool
├── Settings: QueueSettings (owned entity)
├── RowVersion: byte[] (optimistic concurrency)
├── Customers: List<QueueCustomer> (private, mutations through Queue methods)
│
├── AddCustomer(name) → Result<QueueCustomer>
├── CallNext() → Result<QueueCustomer>
├── MarkArrived(token) → Result
├── MarkNoShow(token) → Result
├── RemoveCustomer(token) → Result
└── RecalculatePositions() // private

QueueCustomer (Entity)
├── Id: Guid
├── QueueId: Guid
├── Token: string (unique, 6-8 chars)
├── Name: string
├── JoinedAt: DateTime
├── Position: int
├── Status: CustomerStatus
├── CalledAt: DateTime?
├── GraceDeadline: DateTime?
├── LeftAt: DateTime?
├── NoShowCount: int
├── NearFrontNotifiedAt: DateTime?
└── PushSubscription: string? (JSON)

QueueActivity (Append-only, rolling 30-min window)
├── Id: Guid
├── QueueId: Guid
├── EventType: QueueEventType
└── OccurredAt: DateTime
```

### Value Objects

```csharp
public record QueueSettings
{
    public int GracePeriodMinutes { get; init; } = 5;        // 1-15
    public int MaxCalledAtOnce { get; init; } = 1;           // 1-5
    public bool AutoNoShowEnabled { get; init; } = true;
    public PositionVisibility PositionVisibility { get; init; } = PositionVisibility.ShowExact;
    public bool AllowRejoin { get; init; } = true;
    public int? NotifyWhenNearFront { get; init; } = null;   // e.g., 2 = notify at position 2
    public string? PrimaryColor { get; init; }
    public string? LogoUrl { get; init; }
}

public enum CustomerStatus { Waiting, Called, Arrived, NoShow, Served, Left }
public enum PositionVisibility { ShowExact, ShowRange, HidePosition }
public enum QueueEventType { CustomerJoined, CustomerCalled, CustomerArrived, CustomerLeft }
```

### State Machine

```
        ┌──────────────────────────────────────┐
        │                                      ▼
    [Waiting] ──CallNext()──► [Called] ──MarkArrived()──► [Arrived] ──Complete()──► [Served]
        │                        │
        │                        └──MarkNoShow()──► [NoShow]
        │                                              │
        └──RemoveCustomer()──► [Left]                  └──Rejoin()?──► [Waiting]
                                                         (if AllowRejoin)
```

**Transition Rules:**

- `Waiting` → Called, Left
- `Called` → Arrived, NoShow, Left
- `Arrived` → Served, Left
- `NoShow` → Waiting (if AllowRejoin)
- `Served`, `Left` → terminal (no transitions)

---

## API Layer (Vertical Slices)

### Project Structure

```
src/
├── QueueDrop.Api/
│   ├── Program.cs
│   ├── Features/
│   │   ├── Queues/
│   │   │   ├── CreateQueue.cs           # POST /api/queues
│   │   │   ├── GetQueue.cs              # GET /api/queues/{id}
│   │   │   ├── UpdateQueueSettings.cs   # PATCH /api/queues/{id}/settings
│   │   │   ├── CallNext.cs              # POST /api/queues/{id}/call-next
│   │   │   ├── MarkArrived.cs           # POST /api/queues/{id}/customers/{token}/arrived
│   │   │   ├── MarkNoShow.cs            # POST /api/queues/{id}/customers/{token}/no-show
│   │   │   └── RemoveCustomer.cs        # DELETE /api/queues/{id}/customers/{token}
│   │   │
│   │   ├── Customers/
│   │   │   ├── JoinQueue.cs             # POST /api/join/{businessSlug}
│   │   │   ├── GetPosition.cs           # GET /api/q/{token}
│   │   │   └── SubscribePush.cs         # POST /api/q/{token}/push-subscription
│   │   │
│   │   └── Businesses/
│   │       ├── CreateBusiness.cs        # POST /api/businesses
│   │       └── GetBusiness.cs           # GET /api/businesses/{slug}
│   │
│   ├── Hubs/
│   │   └── QueueHub.cs
│   │
│   └── Infrastructure/
│       ├── Auth/
│       ├── Persistence/
│       └── BackgroundJobs/
```

### Multi-Tenant Scoping

**Staff endpoints:** Filter by `BusinessId` from Auth0 claims

```csharp
db.Queues.Where(q => q.Id == queueId && q.BusinessId == staffBusinessId)
```

**Customer endpoints:** Anonymous, token-based authentication

### Concurrency Handling

```csharp
try
{
    await db.SaveChangesAsync(ct);
}
catch (DbUpdateConcurrencyException)
{
    return TypedResults.Conflict("Queue was updated. Please refresh and try again.");
}
```

---

## SignalR Real-Time Layer

### Hub Design

```csharp
public class QueueHub : Hub
{
    public async Task JoinStaffRoom(Guid businessId)
    {
        // Validate staff owns this business
        await Groups.AddToGroupAsync(Context.ConnectionId, $"staff:{businessId}");
    }

    public async Task JoinCustomerRoom(string token)
    {
        // Validate token exists
        await Groups.AddToGroupAsync(Context.ConnectionId, $"customer:{token}");
    }
}
```

### Server-to-Client Events

| Event             | Target               | Payload                                      | Trigger              |
| ----------------- | -------------------- | -------------------------------------------- | -------------------- |
| `QueueUpdated`    | `staff:{businessId}` | Full queue snapshot                          | Any queue mutation   |
| `PositionChanged` | `customer:{token}`   | position, totalAhead, status, recentActivity | Queue reorder        |
| `YouAreCalled`    | `customer:{token}`   | graceDeadline, queueName                     | CallNext             |
| `NearFrontAlert`  | `customer:{token}`   | position, message                            | Position ≤ threshold |
| `StatusChanged`   | `customer:{token}`   | status, message                              | Any status change    |

### Notifier Interface

```csharp
public interface IQueueHubNotifier
{
    Task QueueUpdated(Guid businessId, QueueSnapshotDto snapshot);
    Task CustomerPositionChanged(string token, PositionDto position);
    Task CustomerCalled(string token, CalledDto details);
    Task CustomerNearFront(string token, int position);
    Task CustomerStatusChanged(string token, CustomerStatus status, string message);
}
```

### Reconnection Strategy

1. Customer page stores `token` in localStorage
2. On reconnect: `hub.invoke("JoinCustomerRoom", token)`
3. Fetch current position via REST as fallback
4. 30s polling backup if SignalR connection fails

---

## Frontend Structure

```
src/client/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── features/
│   │   ├── customer/
│   │   │   ├── JoinQueue.tsx
│   │   │   ├── QueuePosition.tsx
│   │   │   ├── CalledNotice.tsx
│   │   │   └── hooks/
│   │   │       ├── useQueuePosition.ts
│   │   │       └── usePushNotification.ts
│   │   │
│   │   └── staff/
│   │       ├── Dashboard.tsx
│   │       ├── CustomerCard.tsx
│   │       ├── QueueSettings.tsx
│   │       └── hooks/
│   │           └── useQueueUpdates.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   │   └── useSignalR.ts
│   │   └── api/
│   │       └── client.ts
│   │
│   └── lib/
│       ├── signalr.ts
│       └── push.ts
│
├── public/
│   └── sw.js
│
└── index.html
```

### Key UX Flows

**Customer:**

1. Scan QR / click link → `/join/{businessSlug}`
2. Enter name → push permission prompt
3. Redirect to `/q/{token}` → see position
4. Real-time updates via SignalR
5. When called → "You're up!" screen with countdown

**Staff:**

1. Auth0 login → `/dashboard`
2. See queue with customer cards
3. "Call Next" → customer notified
4. Mark "Arrived" or "No Show"
5. Settings panel for tweaking behaviour

---

## Implementation Notes

### AutoNoShow Enforcement

- Background worker (hosted service) runs every 30s
- Scans for `Called` customers past `GraceDeadline`
- Marks as `NoShow` if `AutoNoShowEnabled`

### NotifyWhenNearFront Idempotence

- `NearFrontNotifiedAt` timestamp on `QueueCustomer`
- Only notify if null and position ≤ threshold

### QueueActivity Pruning

- Background job deletes events older than 30 minutes
- Used for "X called in last 5 min" display only

### Push Fallback UX

```
┌─────────────────────────────────────────────┐
│  ⚠️ Notifications blocked                  │
│                                             │
│  Keep this tab open — we'll alert you here  │
│  when it's your turn.                       │
│                                             │
│  [Enable Notifications]                     │
└─────────────────────────────────────────────┘
```

---

## Tech Stack Summary

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Backend         | .NET 8, Minimal API, EF Core                      |
| Database        | PostgreSQL                                        |
| Real-time       | SignalR                                           |
| Auth            | Auth0 (staff only)                                |
| Frontend        | React 19, TypeScript (strict), Tailwind v4, Vite  |
| Notifications   | Web Push API                                      |
| Background Jobs | Hosted services (or Hangfire if complexity grows) |
