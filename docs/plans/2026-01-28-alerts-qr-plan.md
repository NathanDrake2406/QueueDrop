# Near-Front Alerts & QR Code Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Notify customers when they're almost up, and generate QR codes for queue links.

**Architecture:** Near-front alerts trigger in CallNext when remaining customers reach a threshold. QR codes are generated client-side using a lightweight library. Both features integrate with existing SignalR infrastructure.

**Tech Stack:** .NET 8, SignalR, React, qrcode.react library

---

## Task 1: Add NearFrontThreshold to QueueSettings

**Files:**
- Modify: `src/QueueDrop.Domain/Entities/QueueSettings.cs`
- Modify: `src/QueueDrop.Api/Features/Queues/GetSettings.cs`
- Modify: `src/QueueDrop.Api/Features/Queues/UpdateSettings.cs`

**Step 1: Add property to QueueSettings**

In `src/QueueDrop.Domain/Entities/QueueSettings.cs`, add after `CalledMessage`:

```csharp
/// <summary>Position at which to send "almost your turn" notification. Null means disabled.</summary>
public int? NearFrontThreshold { get; init; }
```

**Step 2: Add to GetSettings response**

In `src/QueueDrop.Api/Features/Queues/GetSettings.cs`, add to `Response` record:

```csharp
int? NearFrontThreshold
```

And in the Handler return, add:

```csharp
NearFrontThreshold: queue.Settings.NearFrontThreshold
```

**Step 3: Add to UpdateSettings request**

In `src/QueueDrop.Api/Features/Queues/UpdateSettings.cs`, add to `Request` record:

```csharp
int? NearFrontThreshold
```

And in the Handler where settings is created, add:

```csharp
NearFrontThreshold = request.NearFrontThreshold
```

**Step 4: Run tests**

```bash
dotnet test src/QueueDrop.sln --verbosity quiet
```

**Step 5: Commit**

```bash
git add -A && git commit -m "Add NearFrontThreshold to QueueSettings"
```

---

## Task 2: Add NearFrontNotifiedAt to QueueCustomer

**Files:**
- Modify: `src/QueueDrop.Domain/Entities/QueueCustomer.cs`

**Step 1: Add property and method**

In `src/QueueDrop.Domain/Entities/QueueCustomer.cs`, add after `PushSubscription`:

```csharp
/// <summary>When the customer was notified they're near the front. Null if not yet notified.</summary>
public DateTimeOffset? NearFrontNotifiedAt { get; private set; }

internal void MarkNearFrontNotified(DateTimeOffset timestamp) => NearFrontNotifiedAt = timestamp;
```

**Step 2: Run tests**

```bash
dotnet test src/QueueDrop.sln --verbosity quiet
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Add NearFrontNotifiedAt tracking to QueueCustomer"
```

---

## Task 3: Add NotifyNearFrontAsync to IQueueHubNotifier

**Files:**
- Modify: `src/QueueDrop.Domain/Abstractions/IQueueHubNotifier.cs`
- Modify: `src/QueueDrop.Infrastructure/SignalR/QueueHubNotifier.cs`

**Step 1: Add interface method**

In `src/QueueDrop.Domain/Abstractions/IQueueHubNotifier.cs`, add:

```csharp
/// <summary>
/// Notifies a customer that they're near the front of the queue.
/// </summary>
Task NotifyNearFrontAsync(string customerToken, int position, CancellationToken cancellationToken = default);
```

**Step 2: Implement in QueueHubNotifier**

In `src/QueueDrop.Infrastructure/SignalR/QueueHubNotifier.cs`, add:

```csharp
public async Task NotifyNearFrontAsync(string customerToken, int position, CancellationToken cancellationToken = default)
{
    await _hubContext.Clients.Group($"customer:{customerToken}")
        .SendAsync("NearFront", position, cancellationToken);
}
```

**Step 3: Run tests**

```bash
dotnet test src/QueueDrop.sln --verbosity quiet
```

**Step 4: Commit**

```bash
git add -A && git commit -m "Add NotifyNearFrontAsync to hub notifier"
```

---

## Task 4: Trigger Near-Front Alerts in CallNext

**Files:**
- Modify: `src/QueueDrop.Api/Features/Queues/CallNext.cs`

**Step 1: Add near-front notification logic**

In `src/QueueDrop.Api/Features/Queues/CallNext.cs`, after the position updates loop and before `await Task.WhenAll(notificationTasks)`, add:

```csharp
// Check for near-front alerts
if (queue.Settings.NearFrontThreshold.HasValue)
{
    var threshold = queue.Settings.NearFrontThreshold.Value;
    var customersToNotify = queue.Customers
        .Where(c => c.Status == CustomerStatus.Waiting && c.NearFrontNotifiedAt == null)
        .Select(c => (Customer: c, Position: queue.GetCustomerPosition(c.Id)))
        .Where(x => x.Position.HasValue && x.Position.Value <= threshold)
        .ToList();

    foreach (var (customer, position) in customersToNotify)
    {
        customer.MarkNearFrontNotified(now);

        notificationTasks.Add(notifier.NotifyNearFrontAsync(
            customer.Token,
            position!.Value,
            cancellationToken));

        // Send push notification if subscribed
        if (!string.IsNullOrEmpty(customer.PushSubscription))
        {
            notificationTasks.Add(webPush.SendNotificationAsync(
                customer.PushSubscription,
                "Almost Your Turn!",
                $"You're #{position} in line. Get ready!",
                cancellationToken));
        }
    }
}
```

**Step 2: Run tests**

```bash
dotnet test src/QueueDrop.sln --verbosity quiet
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Trigger near-front alerts when calling next customer"
```

---

## Task 5: Handle NearFront Event in Frontend

**Files:**
- Modify: `src/client/src/features/customer/hooks/useQueuePosition.ts`
- Modify: `src/client/src/features/customer/QueuePosition.tsx`

**Step 1: Add nearFront state to hook**

In `src/client/src/features/customer/hooks/useQueuePosition.ts`, add to `QueuePosition` interface:

```typescript
nearFrontAlert: boolean;
```

Update initial `setData` in `fetchPosition` to include `nearFrontAlert: false`.

Add listener after `unsubStatus`:

```typescript
const unsubNearFront = on<number>("NearFront", (position) => {
  setData((prev) =>
    prev
      ? {
          ...prev,
          position,
          nearFrontAlert: true,
        }
      : null,
  );
});
```

And add to cleanup: `unsubNearFront();`

**Step 2: Show near-front alert in QueuePosition**

In `src/client/src/features/customer/QueuePosition.tsx`, add a NearFrontBanner component after CalledCard:

```typescript
function NearFrontBanner({ position }: { position: number }) {
  return (
    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="text-amber-300 font-medium">Almost your turn!</p>
          <p className="text-amber-400/70 text-sm">You're #{position} - get ready</p>
        </div>
      </div>
    </div>
  );
}
```

In the return, add before the main status div:

```typescript
{data.nearFrontAlert && data.position && data.position > 0 && (
  <NearFrontBanner position={data.position} />
)}
```

**Step 3: Run frontend tests**

```bash
cd src/client && npm test -- --run
```

**Step 4: Commit**

```bash
git add -A && git commit -m "Add near-front alert UI in customer position view"
```

---

## Task 6: Add Near-Front Threshold to Settings UI

**Files:**
- Modify: `src/client/src/features/staff/QueueSettings.tsx`

**Step 1: Add threshold field to form**

Find the settings form and add a new field for near-front threshold. Add to state:

```typescript
const [nearFrontThreshold, setNearFrontThreshold] = useState<number | "">(settings?.nearFrontThreshold ?? "");
```

Add to the form (after noShowTimeoutMinutes field):

```typescript
<div>
  <label htmlFor="nearFrontThreshold" className="block text-sm font-medium text-zinc-400 mb-2">
    Near-front alert position
  </label>
  <input
    type="number"
    id="nearFrontThreshold"
    value={nearFrontThreshold}
    onChange={(e) => setNearFrontThreshold(e.target.value ? parseInt(e.target.value, 10) : "")}
    min={1}
    max={10}
    placeholder="Disabled"
    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
  />
  <p className="text-xs text-zinc-500 mt-1">Notify customers when they reach this position (1-10)</p>
</div>
```

Add to submit payload:

```typescript
nearFrontThreshold: nearFrontThreshold === "" ? null : nearFrontThreshold,
```

**Step 2: Run frontend tests**

```bash
cd src/client && npm test -- --run
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Add near-front threshold setting to queue settings UI"
```

---

## Task 7: Install QR Code Library

**Files:**
- Modify: `src/client/package.json`

**Step 1: Install qrcode.react**

```bash
cd src/client && npm install qrcode.react
```

**Step 2: Commit**

```bash
git add -A && git commit -m "Add qrcode.react dependency"
```

---

## Task 8: Create QRCodeDisplay Component

**Files:**
- Create: `src/client/src/shared/components/QRCodeDisplay.tsx`

**Step 1: Create the component**

```typescript
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  title?: string;
}

export function QRCodeDisplay({ url, size = 200, title }: QRCodeDisplayProps) {
  const handleDownload = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = size * 2;
      canvas.height = size * 2;
      ctx?.fillStyle && (ctx.fillStyle = "#ffffff");
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-code${title ? `-${title.toLowerCase().replace(/\s+/g, "-")}` : ""}.png`;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl">
        <QRCodeSVG
          id="qr-code-svg"
          value={url}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {title && <p className="text-sm text-zinc-400">{title}</p>}
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "Add QRCodeDisplay component"
```

---

## Task 9: Add QR Code to Staff Dashboard

**Files:**
- Modify: `src/client/src/features/staff/StaffDashboard.tsx`

**Step 1: Add QR code modal/section**

Import the component:

```typescript
import { QRCodeDisplay } from "../../shared/components/QRCodeDisplay";
```

Add state for showing QR:

```typescript
const [showQR, setShowQR] = useState(false);
```

Add a QR button in the header area (near the queue tabs or settings):

```typescript
<button
  onClick={() => setShowQR(!showQR)}
  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-xl hover:border-zinc-600 transition-colors"
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
  QR Code
</button>
```

Add the QR display section (conditionally rendered):

```typescript
{showQR && (
  <div className="mb-6 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
    <h3 className="text-lg font-semibold mb-4 text-center">Queue Join Link</h3>
    <QRCodeDisplay
      url={`${window.location.origin}/join/${businessSlug}`}
      title="Scan to join queue"
    />
    <p className="text-xs text-zinc-500 text-center mt-4">
      {window.location.origin}/join/{businessSlug}
    </p>
  </div>
)}
```

**Step 2: Run frontend tests**

```bash
cd src/client && npm test -- --run
```

**Step 3: Commit**

```bash
git add -A && git commit -m "Add QR code display to staff dashboard"
```

---

## Task 10: Add EF Migration for New Fields

**Files:**
- Create: New migration file

**Step 1: Create migration**

```bash
cd src/QueueDrop.Api && dotnet ef migrations add AddNearFrontFields --project ../QueueDrop.Infrastructure
```

**Step 2: Apply migration**

```bash
dotnet ef database update
```

**Step 3: Run all tests**

```bash
dotnet test src/QueueDrop.sln --verbosity quiet
cd src/client && npm test -- --run
```

**Step 4: Commit**

```bash
git add -A && git commit -m "Add EF migration for NearFrontThreshold and NearFrontNotifiedAt"
```

---

## Task 11: Final Integration Test

**Step 1: Start the app**

```bash
# Terminal 1
docker-compose up -d
cd src/QueueDrop.Api && dotnet run

# Terminal 2
cd src/client && npm run dev
```

**Step 2: Manual test checklist**

- [ ] Create/update a queue with NearFrontThreshold = 2
- [ ] Join queue as 3 customers
- [ ] Call next - customer #2 should get near-front alert
- [ ] QR code displays on staff dashboard
- [ ] QR code downloads as PNG
- [ ] Scanning QR code opens join page

**Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "Fix integration issues"
```

---

## Summary

| Task | Description | Commits |
|------|-------------|---------|
| 1 | Add NearFrontThreshold to QueueSettings | 1 |
| 2 | Add NearFrontNotifiedAt to QueueCustomer | 1 |
| 3 | Add NotifyNearFrontAsync to notifier | 1 |
| 4 | Trigger alerts in CallNext | 1 |
| 5 | Handle NearFront event in frontend | 1 |
| 6 | Add threshold to settings UI | 1 |
| 7 | Install qrcode.react | 1 |
| 8 | Create QRCodeDisplay component | 1 |
| 9 | Add QR to staff dashboard | 1 |
| 10 | EF migration | 1 |
| 11 | Integration test | 0-1 |

**Total: ~10-11 commits**
