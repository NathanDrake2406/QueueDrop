# ADR 001: Core Architecture Decisions

**Status:** Accepted
**Date:** January 2026
**Context:** Initial architecture for QueueDrop, a real-time queue management system

---

## Decision 1: Vertical Slice Architecture

### Context

Traditional layered architecture (Controllers → Services → Repositories) leads to:

- Scattered feature code across multiple folders
- High coupling between layers
- Difficult to understand a single feature's full implementation

### Decision

Organize code by **feature** rather than technical layer. Each feature contains its handler, DTOs, and validation in a single file.

```
Features/
├── Customers/
│   ├── JoinQueue.cs      # POST /api/join - handler + request/response + validation
│   └── GetPosition.cs    # GET /api/q/{token}
├── Queues/
│   ├── CallNext.cs
│   └── GetQueueCustomers.cs
```

### Consequences

✅ **Good:** Feature code is cohesive and easy to locate
✅ **Good:** Adding features doesn't require touching multiple layers
✅ **Good:** Deleting a feature is one file deletion
⚠️ **Tradeoff:** Some duplication between similar features (acceptable)

---

## Decision 2: SignalR over Polling for Real-Time Updates

### Context

Customers need live position updates. Options considered:

1. **Polling** - Client polls every N seconds
2. **Server-Sent Events (SSE)** - One-way server push
3. **WebSockets (raw)** - Bidirectional, manual protocol
4. **SignalR** - WebSocket abstraction with fallback

### Decision

Use **SignalR** for real-time communication.

### Rationale

| Factor           | Polling                  | SSE    | WebSocket | SignalR                  |
| ---------------- | ------------------------ | ------ | --------- | ------------------------ |
| Latency          | High (interval-based)    | Low    | Low       | Low                      |
| Server load      | High (constant requests) | Medium | Low       | Low                      |
| Reconnection     | Manual                   | Manual | Manual    | **Automatic**            |
| Browser support  | Universal                | Good   | Good      | **Universal (fallback)** |
| .NET integration | N/A                      | Manual | Manual    | **First-class**          |

### Consequences

✅ **Good:** Sub-second position updates
✅ **Good:** Automatic reconnection with exponential backoff
✅ **Good:** Fallback to long-polling for restrictive networks
✅ **Good:** 500 concurrent connections tested with <2ms latency
⚠️ **Tradeoff:** Requires sticky sessions for scale-out (solved with Redis backplane)

---

## Decision 3: Token-Based Customer Identity

### Context

Customers need to track their queue position without creating accounts. Options:

1. **Session-based** - Server stores session, cookie identifies user
2. **Account-based** - Require signup/login
3. **Token-based** - Unique URL per customer (`/q/{token}`)

### Decision

Generate a unique token per queue entry. The token IS the customer's identity.

```
POST /api/join/demo-shop/main-queue
→ { "token": "fmuwVWtBs44", "position": 5 }

Customer URL: /q/fmuwVWtBs44
```

### Rationale

- **Zero friction** - No signup, no login, instant join
- **Shareable** - Customer can check position on any device
- **Stateless** - No server-side session management
- **Privacy** - Token is unguessable (11-char base64)

### Consequences

✅ **Good:** Frictionless customer experience
✅ **Good:** Works across devices (share URL)
✅ **Good:** No session storage required
⚠️ **Tradeoff:** Token in URL visible in browser history (acceptable for queue position)
⚠️ **Tradeoff:** Lost token = lost access (mitigated by localStorage backup)

---

## Decision 4: Result<T> for Error Handling

### Context

Methods can fail for expected reasons (validation, business rules) vs unexpected reasons (bugs, infrastructure). Options:

1. **Exceptions for everything** - Throw on any error
2. **Null returns** - Return null on failure
3. **Result<T> pattern** - Explicit success/failure type

### Decision

Use `Result<T>` for expected failures. Reserve exceptions for bugs.

```csharp
// Domain method returns Result
public Result<QueueCustomer> CallNext()
{
    if (!_customers.Any(c => c.Status == Waiting))
        return Result.Failure<QueueCustomer>(QueueErrors.NoCustomersWaiting);

    var customer = _customers.OrderBy(c => c.JoinedAt).First();
    customer.MarkCalled(_timeProvider.GetUtcNow());
    return Result.Success(customer);
}

// Handler translates Result to HTTP
var result = queue.CallNext();
return result.IsSuccess
    ? Results.Ok(result.Value)
    : Results.NotFound(result.Error);
```

### Rationale

- **Honest signatures** - Return type tells you what can happen
- **Compiler-enforced** - Must handle both success and failure
- **No exception overhead** - Expected failures are cheap
- **Testable** - Assert on Result state, not catch blocks

### Consequences

✅ **Good:** Explicit error handling, no hidden control flow
✅ **Good:** Domain errors don't leak infrastructure concerns
✅ **Good:** Easy to test both success and failure paths
⚠️ **Tradeoff:** More verbose than throwing exceptions

---

## Decision 5: Queue as Aggregate Root

### Context

Multiple operations modify queue state (join, call next, mark served). Need to maintain invariants:

- Position numbers must be sequential
- Only one customer can be "Called" at a time
- Concurrency conflicts must be detected

### Decision

`Queue` is the **aggregate root**. All mutations go through Queue methods.

```csharp
public class Queue
{
    private readonly List<QueueCustomer> _customers = new();
    public IReadOnlyList<QueueCustomer> Customers => _customers.AsReadOnly();

    // All mutations through aggregate methods
    public Result<QueueCustomer> AddCustomer(string name, ...) { }
    public Result<QueueCustomer> CallNext() { }
    public Result RemoveCustomer(Guid customerId) { }
}
```

### Rationale

- **Invariant enforcement** - Queue ensures business rules
- **Encapsulation** - Customers can't be modified directly
- **Concurrency** - Single RowVersion on Queue for optimistic locking
- **Testability** - Unit test Queue in isolation

### Consequences

✅ **Good:** Business rules in one place
✅ **Good:** Optimistic concurrency with single version check
✅ **Good:** Domain model is testable without database
⚠️ **Tradeoff:** Loading queue loads all customers (acceptable for queue sizes <1000)

---

## Decision 6: Multi-Queue Support via URL Slugs

### Context

Businesses need multiple queues (Dine-in, Takeout, Bar). Options:

1. **Query parameter** - `/join/demo-shop?queue=takeout`
2. **Nested ID** - `/join/demo-shop/queues/123`
3. **URL slug** - `/join/demo-shop/takeout`

### Decision

Use human-readable slugs in URLs.

```
/join/demo-shop           → Queue selector (if multiple)
/join/demo-shop/takeout   → Direct join to Takeout queue
/staff/demo-shop          → Dashboard with all queues (tabs)
```

### Rationale

- **Memorable URLs** - Customers can type or remember
- **SEO-friendly** - If public-facing in future
- **QR code friendly** - Short, readable URLs
- **Backwards compatible** - Single-queue businesses still work

### Consequences

✅ **Good:** Clean, shareable URLs
✅ **Good:** Natural URL structure
⚠️ **Tradeoff:** Slug must be unique per business (enforced by DB constraint)

---

## Summary

| Decision        | Pattern                    | Key Benefit              |
| --------------- | -------------------------- | ------------------------ |
| Vertical Slices | Feature-based organization | Cohesion                 |
| SignalR         | Real-time abstraction      | Auto-reconnect, fallback |
| Token Identity  | URL-based identity         | Zero friction            |
| Result<T>       | Explicit error handling    | Honest signatures        |
| Aggregate Root  | Queue owns customers       | Invariant enforcement    |
| URL Slugs       | Human-readable paths       | Usability                |

---

## References

- [Vertical Slice Architecture - Jimmy Bogard](https://www.jimmybogard.com/vertical-slice-architecture/)
- [SignalR Documentation](https://learn.microsoft.com/en-us/aspnet/core/signalr/)
- [Domain-Driven Design - Aggregates](https://martinfowler.com/bliki/DDD_Aggregate.html)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
