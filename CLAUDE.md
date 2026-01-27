# QueueDrop - Project Guidelines

## Project Overview

QueueDrop is a customer waitlist web app for queue management (restaurants, barbers, etc.). Customers join a queue, see their live position, and get notified when it's their turn. Staff manage the queue from a dashboard.

## Tech Stack

- **Backend:** .NET 8, Minimal API, Vertical Slice Architecture, PostgreSQL, EF Core
- **Real-time:** SignalR for live queue position updates
- **Frontend:** React 19 + TypeScript (strict) + Tailwind CSS v4 + Vite
- **Auth:** Auth0 for staff login, customers are anonymous (join via link/QR code)
- **Notifications:** Web Push (no SMS for MVP)

## Architecture Decisions

- **Vertical slices:** Features folder, each feature self-contained (handler + DTOs + validation in one file)
- **Domain model:** Entities with encapsulated logic, factory methods, `Result<T>` for errors
- **Queue as Aggregate Root:** All queue mutations go through `Queue` methods, enforces invariants
- **Token-based customer identity:** Unique URL per customer (`/q/{token}`), stored in localStorage
- **Single queue per business for MVP:** Data model supports multiple, UI assumes one active queue
- **Optimistic concurrency:** `RowVersion` on `Queue` aggregate, catch `DbUpdateConcurrencyException` → 409

## Code Review & Teaching Principles

When teaching, reviewing code, or pair programming, actively identify opportunities to apply these principles. Don't let violations slide — point them out with the relevant "Ask" question. Focus feedback on Foundational pillars until they're reflexive. Introduce Intermediate/Advanced only when the code naturally encounters those concerns.

### Foundational (Apply Always)

1. **Immutability by Default**: Prefer `record`, `IReadOnlyList`, and `init` setters. Note: `IReadOnly*` hides mutators but doesn't guarantee immutability — avoid sharing mutable backing collections across boundaries. If data must cross boundaries, prefer immutable collections or defensive copies. Prefer `ImmutableArray<T>` for read-heavy sequences (cheap index/iteration, expensive adds), `ImmutableList<T>` only when you truly need frequent structural edits; for read-mostly lookup tables use `FrozenDictionary`/`FrozenSet` (build once, read fast). Prefer `record`/`record struct` for value objects; entities may be mutable. Carve-out: EF Core entities, ORM materialisation, and JSON binding may require mutability — don't fight tooling. _Ask: "Could this data be immutable?"_

2. **Honest Signatures**: No exceptions for control flow. Return `Result<T>` for expected failures (input validation + domain rule rejections). Throw for bugs and invariant corruption. Infrastructure may throw; catch at boundaries and translate to `Result` if you want user-facing errors — but don't catch-and-swallow; log and preserve cause. _Ask: "Does this signature tell the whole truth about what can happen?"_

3. **Make Illegal States Unrepresentable**: Design types where invalid states can't exist (e.g., `EmailAddress` vs `string`, discriminated unions for status). _Ask: "Can a type prevent this invalid state entirely?"_

4. **Parse, Don't Validate**: Transform raw input into types that guarantee correctness at the boundary. Parse once per trust boundary; don't scatter validation inside the core. _Ask: "Are we validating repeatedly, or parsing once into proof?"_

5. **Functional Core, Imperative Shell**: Business logic is side-effect free beyond in-memory state — no DB, no HTTP, no clocks, no randomness, no globals. Shell does I/O around the core: load → call core → persist/emit. _Ask: "Is this logic contaminated with I/O?"_

6. **Composition Over Inheritance**: Small, single-purpose components that plug together. Avoid deep class hierarchies. _Ask: "Am I inheriting behaviour I could compose instead?"_

7. **Boundary Mapping (Anti-Corruption Layer)**: Don't let transport/persistence shapes drive the domain. Map at real boundaries (external APIs, persistence, other bounded contexts). Application core owns interfaces (ports); infrastructure implements them. Domain model depends on no infrastructure (BCL is fine). _Ask: "Are we leaking infrastructure shapes into the domain, or domain shapes outward?"_

### Intermediate (Apply Consistently)

8. **Tell, Don't Ask**: Objects expose behaviour, not data for others to manipulate. Don't interrogate an object's state to make decisions outside it. Apply to entities and aggregates; value objects can be transparent by design. _Ask: "Are we micromanaging this object's internals?"_

9. **Command-Query Separation (CQS)**: Methods either mutate state OR return data. Never both. Pragmatic exception: commands may return `void`, `Result`, an ID, or a version/etag — just not rich read models. _Ask: "Is this a command or a query? Why is it doing both?"_

10. **Time/Randomness as Dependencies**: Inject `TimeProvider` (the .NET 8 abstraction), not `DateTime.Now`. Use fake providers in tests. _Ask: "Can I test this with a fixed time or seed?"_

11. **Async Hygiene**: `async` all the way down — no `.Result`, no `.Wait()`, no `Task.Run()` to fake async. Use `ConfigureAwait(false)` in library code only, not app code. Async methods return `Task`/`Task<T>`, not `void` (except event handlers). Carve-out: `Task.Run()` is OK for CPU-bound offload in UI apps; in ASP.NET Core request paths avoid it — use hosted services (`BackgroundService`/`IHostedService`) for deliberate background work. _Ask: "Is this async chain clean, or are we blocking somewhere?"_

12. **Cancellation/Timeout Discipline**: Every async boundary and I/O path (HTTP, DB, queue) takes a `CancellationToken` and passes it down. Every remote dependency (HTTP, DB, queue) has an explicit timeout. HTTP clients are managed via `IHttpClientFactory`/typed clients; DB timeouts are set explicitly (e.g., EF Core `Database.SetCommandTimeout`). Nothing hangs forever. _Ask: "Can this be cancelled? Will it time out?"_

### Advanced (Apply When Scaling)

13. **Vertical Slices**: Organise by feature, not by layer. A feature's handler, validator, and query live together. _Ask: "Is this code cohesive by feature or scattered by layer?"_

14. **Domain Events**: Decouple side effects from the action that triggers them. Events are facts raised during execution; handlers perform side effects. Handlers must not perform external I/O inside the transaction — dispatch after commit if handlers touch infrastructure. Note: domain events are in-process; integration events cross process boundaries and need reliable delivery (see #16). _Ask: "Should this side effect be a separate event handler?"_

### Defensive (Apply When Needed)

15. **Optimistic Concurrency**: Assume conflicting writes. Use rowversion/ETags to detect conflicts — don't silently overwrite. _Ask: "What happens if two requests modify this simultaneously?"_

16. **Idempotency + Outbox**: Assume retries and duplicates. Commands must be safe to repeat. For integration events (cross-process), use an outbox pattern — store the event in the same transaction as the DB change, then relay it — to avoid dual-write bugs. Note: outbox solves producer-side delivery; consumers still need idempotency (inbox/dedup) because at-least-once delivery creates duplicates. _Ask: "If this runs twice, do we get the same outcome?"_

### Cross-Cutting (Apply Always)

17. **Observability by Default**: Use message templates with named properties; avoid eager string interpolation in log calls. Logs must include an operation/trace ID (`Activity`/traceparent) and key domain identifiers. Correlation IDs across requests, metrics for things that matter. Log at boundaries, not inside every method. _Ask: "If this fails in production, will I know what happened and why?"_

18. **Security by Default**: Validate authorisation at boundaries. Never log secrets or PII. Treat all input as hostile across trust boundaries. Parsing is not security. _Ask: "Could this expose data or allow an action the user shouldn't take?"_

19. **Testing Discipline**: Pure core gets fast unit tests and property-based tests for tricky invariants. Boundaries get a thin layer of integration tests. Avoid mocking everything. _Ask: "What's the cheapest test that catches the real failure mode?"_

20. **Resilience by Default**: For remote calls, use bounded retries (with jitter) only when safe, circuit breakers for flaky dependencies, and backoff/timeout budgets. Never retry non-idempotent writes unless you've made them idempotent. _Ask: "If this dependency flakes, do we fail fast, degrade gracefully, or melt down?"_

21. **Nullable Discipline**: Enable NRT (`<Nullable>enable</Nullable>`) and treat nullability warnings as errors in core projects (`WarningsAsErrors=nullable`). This is "make illegal states unrepresentable" applied to the most common C# bug class. _Ask: "Is nullability explicit and enforced here?"_
