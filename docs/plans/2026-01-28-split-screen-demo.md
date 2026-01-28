# Split-Screen Demo Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/demo` route that shows staff and customer views side-by-side with real SignalR updates.

**Architecture:** Single page with two embedded panels. Left panel shows a simplified staff dashboard (no auth required). Right panel shows a customer's live position. Both connect to the same SignalR hub. A customer selector lets you pick which customer to watch. Add/Reset buttons manage demo data.

**Tech Stack:** React, SignalR (existing hooks), existing API endpoints, no new backend required.

---

## Task 1: Create Demo Page Shell

**Files:**
- Create: `src/client/src/features/demo/DemoPage.tsx`
- Modify: `src/client/src/App.tsx` (add route)

**Step 1: Create the demo page component with layout**

```tsx
// src/client/src/features/demo/DemoPage.tsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DEMO_BUSINESS_SLUG = "demo-shop";

interface Customer {
  id: string;
  name: string;
  token: string;
  position: number;
  status: string;
  joinedAt: string;
}

interface QueueData {
  queueId: string;
  queueName: string;
  customers: Customer[];
}

export function DemoPage() {
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [selectedCustomerToken, setSelectedCustomerToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    try {
      // First get the queue ID from business
      const businessRes = await fetch(`${API_BASE}/api/business/${DEMO_BUSINESS_SLUG}/queues`);
      if (!businessRes.ok) throw new Error("Demo business not found");
      const businessData = await businessRes.json();

      if (!businessData.queues?.length) throw new Error("No queues found");
      const queueId = businessData.queues[0].queueId;

      // Then get customers
      const customersRes = await fetch(`${API_BASE}/api/queues/${queueId}/customers`);
      if (!customersRes.ok) throw new Error("Failed to load queue");
      const customersData = await customersRes.json();

      setQueueData({
        queueId,
        queueName: businessData.queues[0].name,
        customers: customersData.customers || [],
      });

      // Auto-select first waiting customer if none selected
      if (!selectedCustomerToken && customersData.customers?.length > 0) {
        const firstWaiting = customersData.customers.find((c: Customer) => c.status === "Waiting");
        if (firstWaiting) setSelectedCustomerToken(firstWaiting.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCustomerToken]);

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/" className="text-violet-400 hover:text-violet-300">← Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-zinc-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold">Interactive Demo</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Real-time SignalR updates</span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Split view */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-57px)]">
        {/* Left: Staff view */}
        <div className="flex-1 border-r border-zinc-800 p-4 lg:p-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Staff Dashboard</h2>
            <p className="text-zinc-600">Staff panel coming in Task 2...</p>
          </div>
        </div>

        {/* Right: Customer view */}
        <div className="flex-1 p-4 lg:p-6 bg-zinc-900/50">
          <div className="max-w-lg mx-auto">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Customer View</h2>
            <p className="text-zinc-600">Customer panel coming in Task 3...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

In `src/client/src/App.tsx`, add import and route:

```tsx
// Add import at top
import { DemoPage } from "./features/demo/DemoPage";

// Add route before the 404 catch-all (around line 364)
<Route path="/demo" element={<DemoPage />} />
```

**Step 3: Run and verify**

```bash
cd src/client && npm run dev
```

Visit http://localhost:5173/demo - should see split layout with placeholders.

**Step 4: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx src/client/src/App.tsx
git commit -m "feat: add demo page shell with split layout"
```

---

## Task 2: Build Staff Panel Component

**Files:**
- Modify: `src/client/src/features/demo/DemoPage.tsx`

**Step 1: Add staff panel with customer list and actions**

Replace the staff panel placeholder with a working component. Add these inside DemoPage.tsx:

```tsx
// Add after the interfaces, before the DemoPage function:

function StaffPanel({
  queueData,
  onRefresh,
  onCustomerSelect,
  selectedCustomerToken,
}: {
  queueData: QueueData;
  onRefresh: () => void;
  onCustomerSelect: (token: string) => void;
  selectedCustomerToken: string | null;
}) {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCallingNext, setIsCallingNext] = useState(false);

  const waitingCustomers = queueData.customers.filter(c => c.status === "Waiting");
  const calledCustomers = queueData.customers.filter(c => c.status === "Called");

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      await fetch(`${API_BASE}/api/demo/seed?queueId=${queueData.queueId}`, { method: "POST" });
      onRefresh();
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCallNext = async () => {
    setIsCallingNext(true);
    try {
      await fetch(`${API_BASE}/api/queues/${queueData.queueId}/call-next`, { method: "POST" });
      onRefresh();
    } finally {
      setIsCallingNext(false);
    }
  };

  const handleAction = async (action: string, customerId: string) => {
    const endpoints: Record<string, { url: string; method: string }> = {
      serve: { url: `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}/serve`, method: "POST" },
      "no-show": { url: `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}/no-show`, method: "POST" },
      remove: { url: `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}`, method: "DELETE" },
    };
    const { url, method } = endpoints[action];
    await fetch(url, { method });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleCallNext}
          disabled={isCallingNext || waitingCustomers.length === 0}
          className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isCallingNext ? "Calling..." : "Call Next"}
        </button>
        <button
          onClick={handleSeedDemo}
          disabled={isSeeding}
          className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isSeeding ? "..." : "+ Add Demo Customers"}
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-zinc-500">Waiting: <span className="text-white font-medium">{waitingCustomers.length}</span></span>
        <span className="text-zinc-500">Called: <span className="text-amber-400 font-medium">{calledCustomers.length}</span></span>
      </div>

      {/* Called customers */}
      {calledCustomers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Called</p>
          {calledCustomers.map(customer => (
            <div
              key={customer.id}
              onClick={() => onCustomerSelect(customer.token)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedCustomerToken === customer.token
                  ? "bg-amber-500/20 border-amber-500/40"
                  : "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-300">{customer.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction("serve", customer.id); }}
                    className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"
                  >
                    Served
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction("no-show", customer.id); }}
                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                  >
                    No-show
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Waiting customers */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Waiting ({waitingCustomers.length})</p>
        {waitingCustomers.length === 0 ? (
          <div className="p-6 bg-zinc-800/50 border border-zinc-700 rounded-xl text-center text-zinc-500">
            No customers waiting. Click "Add Demo Customers" to populate.
          </div>
        ) : (
          waitingCustomers.map((customer, index) => (
            <div
              key={customer.id}
              onClick={() => onCustomerSelect(customer.token)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedCustomerToken === customer.token
                  ? "bg-violet-500/20 border-violet-500/40"
                  : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="font-medium">{customer.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction("remove", customer.id); }}
                  className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedCustomerToken === customer.token && (
                <p className="text-xs text-violet-400 mt-1">← Viewing this customer's perspective</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update DemoPage to use StaffPanel**

Replace the staff placeholder div with:

```tsx
{/* Left: Staff view */}
<div className="flex-1 border-r border-zinc-800 p-4 lg:p-6 overflow-y-auto">
  <div className="max-w-lg mx-auto">
    <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Staff Dashboard</h2>
    {queueData && (
      <StaffPanel
        queueData={queueData}
        onRefresh={fetchQueueData}
        onCustomerSelect={setSelectedCustomerToken}
        selectedCustomerToken={selectedCustomerToken}
      />
    )}
  </div>
</div>
```

**Step 3: Test**

Visit http://localhost:5173/demo - staff panel should work, can add customers and call next.

**Step 4: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx
git commit -m "feat: add staff panel to demo page"
```

---

## Task 3: Build Customer Panel with Live Position

**Files:**
- Modify: `src/client/src/features/demo/DemoPage.tsx`

**Step 1: Create CustomerPanel component**

Add this component to DemoPage.tsx (after StaffPanel):

```tsx
function CustomerPanel({ token }: { token: string | null }) {
  const [data, setData] = useState<{
    position: number;
    status: string;
    queueName: string;
    businessName: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch position when token changes
  useEffect(() => {
    if (!token) {
      setData(null);
      return;
    }

    setIsLoading(true);
    fetch(`${API_BASE}/api/q/${token}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setData(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center text-zinc-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <p>Select a customer from the staff panel</p>
          <p className="text-sm text-zinc-600 mt-1">to see their live view</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <p className="text-zinc-500">Customer not found</p>
      </div>
    );
  }

  const isCalled = data.status === "Called";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-zinc-500 text-sm">{data.businessName}</p>
        <p className="text-zinc-400">{data.queueName}</p>
      </div>

      {/* Status */}
      {isCalled ? (
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">It's Your Turn!</h2>
          <p className="text-emerald-200/80">Please proceed to the counter</p>
        </div>
      ) : (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-3xl p-8 text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-wider mb-4">Your position</p>
          <div className="text-8xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            {data.position}
          </div>
          <p className="text-zinc-400 mt-4">
            {data.position === 1
              ? "You're next!"
              : `${data.position - 1} ${data.position - 1 === 1 ? "person" : "people"} ahead`}
          </p>
        </div>
      )}

      {/* Connection indicator */}
      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-xs text-zinc-500">Connected via SignalR</span>
      </div>
    </div>
  );
}
```

**Step 2: Update DemoPage to use CustomerPanel**

Replace the customer placeholder with:

```tsx
{/* Right: Customer view */}
<div className="flex-1 p-4 lg:p-6 bg-zinc-900/50 overflow-y-auto">
  <div className="max-w-md mx-auto">
    <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Customer View</h2>
    <CustomerPanel token={selectedCustomerToken} />
  </div>
</div>
```

**Step 3: Test**

Visit http://localhost:5173/demo, add demo customers, select one, see their position.

**Step 4: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx
git commit -m "feat: add customer panel to demo page"
```

---

## Task 4: Add SignalR Live Updates

**Files:**
- Modify: `src/client/src/features/demo/DemoPage.tsx`

**Step 1: Import and use the existing SignalR hook**

At the top of DemoPage.tsx, add:

```tsx
import { useSignalR } from "../../shared/hooks/useSignalR";
```

**Step 2: Add SignalR connection to CustomerPanel**

Replace the CustomerPanel component with a version that uses SignalR:

```tsx
function CustomerPanel({ token }: { token: string | null }) {
  const [data, setData] = useState<{
    position: number;
    status: string;
    queueName: string;
    businessName: string;
    calledMessage?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // SignalR connection
  const { connection, connectionState: signalRState } = useSignalR();

  // Update connection state
  useEffect(() => {
    if (signalRState === "Connected") setConnectionState("connected");
    else if (signalRState === "Connecting" || signalRState === "Reconnecting") setConnectionState("connecting");
    else setConnectionState("disconnected");
  }, [signalRState]);

  // Join customer room and listen for updates
  useEffect(() => {
    if (!connection || !token || signalRState !== "Connected") return;

    // Join customer room
    connection.invoke("JoinCustomerRoom", token).catch(console.error);

    // Listen for position changes
    const handlePositionChanged = (newData: { position: number; status: string }) => {
      setData(prev => prev ? { ...prev, ...newData } : null);
    };

    // Listen for called event
    const handleCalled = () => {
      setData(prev => prev ? { ...prev, status: "Called" } : null);
    };

    connection.on("PositionChanged", handlePositionChanged);
    connection.on("Called", handleCalled);

    return () => {
      connection.off("PositionChanged", handlePositionChanged);
      connection.off("Called", handleCalled);
      connection.invoke("LeaveCustomerRoom", token).catch(() => {});
    };
  }, [connection, token, signalRState]);

  // Fetch initial position when token changes
  useEffect(() => {
    if (!token) {
      setData(null);
      return;
    }

    setIsLoading(true);
    fetch(`${API_BASE}/api/q/${token}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setData(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center text-zinc-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <p>Select a customer from the staff panel</p>
          <p className="text-sm text-zinc-600 mt-1">to see their live view</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <p className="text-zinc-500">Customer not found</p>
      </div>
    );
  }

  const isCalled = data.status === "Called";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-zinc-500 text-sm">{data.businessName}</p>
        <p className="text-zinc-400">{data.queueName}</p>
      </div>

      {/* Status */}
      {isCalled ? (
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-8 text-center animate-pulse">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">It's Your Turn!</h2>
          <p className="text-emerald-200/80">{data.calledMessage || "Please proceed to the counter"}</p>
        </div>
      ) : (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-3xl p-8 text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-wider mb-4">Your position</p>
          <div className="text-8xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent transition-all">
            {data.position}
          </div>
          <p className="text-zinc-400 mt-4">
            {data.position === 1
              ? "You're next!"
              : `${data.position - 1} ${data.position - 1 === 1 ? "person" : "people"} ahead`}
          </p>
        </div>
      )}

      {/* Connection indicator */}
      <div className="flex items-center justify-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionState === "connected" ? "bg-emerald-500" :
          connectionState === "connecting" ? "bg-amber-500 animate-pulse" :
          "bg-red-500"
        }`} />
        <span className="text-xs text-zinc-500">
          {connectionState === "connected" ? "Live updates active" :
           connectionState === "connecting" ? "Connecting..." : "Disconnected"}
        </span>
      </div>
    </div>
  );
}
```

**Step 3: Test live updates**

1. Open http://localhost:5173/demo
2. Add demo customers
3. Select a customer (e.g., #3)
4. Click "Call Next" - watch position update without refresh!

**Step 4: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx
git commit -m "feat: add SignalR live updates to demo customer panel"
```

---

## Task 5: Add Staff Panel SignalR Updates

**Files:**
- Modify: `src/client/src/features/demo/DemoPage.tsx`

**Step 1: Add SignalR to StaffPanel**

Update the StaffPanel to receive live updates. Modify it to accept and use a connection:

```tsx
// Update StaffPanel props
function StaffPanel({
  queueData,
  onRefresh,
  onCustomerSelect,
  selectedCustomerToken,
}: {
  queueData: QueueData;
  onRefresh: () => void;
  onCustomerSelect: (token: string) => void;
  selectedCustomerToken: string | null;
}) {
  // ... existing code ...
}
```

**Step 2: Add SignalR listener in DemoPage for queue updates**

In the DemoPage function, add SignalR handling:

```tsx
// Add after the fetchQueueData definition
const { connection, connectionState: signalRState } = useSignalR();

// Listen for queue updates
useEffect(() => {
  if (!connection || signalRState !== "Connected" || !queueData) return;

  // Join staff room for this business
  connection.invoke("JoinStaffRoom", "11111111-1111-1111-1111-111111111111").catch(console.error);

  // Listen for queue updates
  const handleQueueUpdated = () => {
    fetchQueueData();
  };

  connection.on("QueueUpdated", handleQueueUpdated);

  return () => {
    connection.off("QueueUpdated", handleQueueUpdated);
  };
}, [connection, signalRState, queueData, fetchQueueData]);
```

**Step 3: Update header to show connection state**

Replace the connection indicator in the header:

```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-zinc-500">Real-time updates</span>
  <div className={`w-2 h-2 rounded-full ${
    signalRState === "Connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
  }`} />
</div>
```

**Step 4: Test**

Both panels should update in real-time when actions happen.

**Step 5: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx
git commit -m "feat: add SignalR updates to staff panel"
```

---

## Task 6: Polish and Final Testing

**Files:**
- Modify: `src/client/src/features/demo/DemoPage.tsx`
- Modify: `src/client/src/App.tsx`

**Step 1: Add instructional overlay/tooltip**

Add a brief instruction banner:

```tsx
{/* Add after header, before split view */}
<div className="bg-violet-500/10 border-b border-violet-500/20 px-4 py-2">
  <div className="max-w-7xl mx-auto text-center text-sm text-violet-300">
    <span className="font-medium">Try it:</span> Click "Call Next" on the left, watch the customer position update on the right in real-time!
  </div>
</div>
```

**Step 2: Add Reset Demo button**

In StaffPanel, add a reset button:

```tsx
// Add after the + Add Demo Customers button
<button
  onClick={async () => {
    // Clear and re-seed
    await fetch(`${API_BASE}/api/demo/seed?queueId=${queueData.queueId}`, { method: "POST" });
    onRefresh();
  }}
  className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
  title="Reset demo to initial state"
>
  ↺ Reset
</button>
```

**Step 3: Update landing page demo buttons**

In App.tsx, update the landing page to link to /demo instead of separate pages:

```tsx
// In LandingPage, update the hero buttons (around line 79-90)
<button
  onClick={() => navigate("/demo")}
  className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 transition-colors"
>
  Try Interactive Demo
</button>
```

**Step 4: Run full test**

1. Start API: `cd src/QueueDrop.Api && dotnet run`
2. Start frontend: `cd src/client && npm run dev`
3. Visit http://localhost:5173/demo
4. Click "Add Demo Customers"
5. Select a customer
6. Click "Call Next" - verify both panels update
7. Click "Served" - verify customer removed from both views

**Step 5: Commit**

```bash
git add src/client/src/features/demo/DemoPage.tsx src/client/src/App.tsx
git commit -m "feat: polish demo page with instructions and reset button"
```

---

## Summary

After completing all tasks, you'll have:

1. **Split-screen demo at `/demo`** showing staff and customer views side-by-side
2. **Real SignalR updates** - both panels update live
3. **No auth required** - anyone can try it immediately
4. **Demo data management** - Add customers, reset queue
5. **Customer selector** - Click any customer to see their perspective

This is the "wow moment" for the portfolio - recruiters click demo, see two panels, click "Call Next", watch both update simultaneously.
