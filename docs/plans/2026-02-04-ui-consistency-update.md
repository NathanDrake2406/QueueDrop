# UI Consistency Update - Match Demo Page Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update all customer and staff pages to match the polished demo page design language.

**Architecture:** Apply consistent design tokens (sharp corners, custom shadows, gradient backgrounds, refined typography) across QueuePosition, StaffDashboard, JoinQueue, and their shared components. Changes are purely cosmetic - no logic changes.

**Tech Stack:** React, Tailwind CSS v4, Next.js App Router

---

## Design Token Reference (from DemoPage)

| Element | Old Style | New Style |
|---------|-----------|-----------|
| Border radius | `rounded-xl`, `rounded-2xl`, `rounded-3xl` | `rounded-none` |
| Card shadows | `shadow-lg` | `shadow-[0_14px_40px_rgba(0,0,0,0.35)]` (dark), `shadow-[0_12px_30px_rgba(15,23,42,0.08)]` (light) |
| Button shadows | none | `shadow-[0_14px_30px_rgba(16,185,129,0.28)]` (teal) |
| Label text | normal case | `text-[11px] uppercase tracking-[0.08em]` |
| Borders | `border-slate-800` | `border-white/5` or `border-slate-700` |
| Active states | solid background | gradient + glow: `shadow-[0_14px_30px_rgba(16,185,129,0.25)]` |

---

### Task 1: Update Shared Skeleton Components

**Files:**
- Modify: `src/client/src/shared/components/Skeleton.tsx`

**Step 1: Update all rounded classes to rounded-none**

Replace all `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-lg` with `rounded-none`.

```tsx
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-800 rounded-none ${className}`} />;
}

export function CustomerCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-none" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-20 h-10 rounded-none" />
      </div>
    </div>
  );
}

export function QueueControlsSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <Skeleton className="h-7 w-48 mb-3" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-8">
          <div className="text-center">
            <Skeleton className="h-10 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="text-center">
            <Skeleton className="h-10 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-14 w-32 rounded-none" />
        <Skeleton className="h-14 w-28 rounded-none" />
        <Skeleton className="h-14 w-14 rounded-none" />
      </div>
    </div>
  );
}

export function QueuePositionSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="bg-slate-900 border border-slate-800 rounded-none p-8 text-center">
          <Skeleton className="h-32 w-32 mx-auto rounded-none mb-6" />
          <Skeleton className="h-6 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <QueueControlsSkeleton />
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="space-y-3">
            <CustomerCardSkeleton />
            <CustomerCardSkeleton />
            <CustomerCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no visual regressions**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/shared/components/Skeleton.tsx
git commit -m "style: update Skeleton components to sharp corners"
```

---

### Task 2: Update QueueTabs Component

**Files:**
- Modify: `src/client/src/features/staff/components/QueueTabs.tsx`

**Step 1: Apply demo page tab styling**

Update to match demo page's queue tabs with sharp corners, gradient active states, and enhanced shadows.

```tsx
interface QueueTab {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
}

interface QueueTabsProps {
  queues: QueueTab[];
  activeQueueId: string | null;
  onSelectQueue: (queueId: string | null) => void;
}

export function QueueTabs({ queues, activeQueueId, onSelectQueue }: QueueTabsProps) {
  const totalWaiting = queues.reduce((sum, q) => sum + q.waitingCount, 0);

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {/* All queues tab */}
      <button
        onClick={() => onSelectQueue(null)}
        className={`px-4 py-2 rounded-none font-medium text-sm transition-all border ${
          activeQueueId === null
            ? "bg-emerald-500/20 border-emerald-400/40 text-white shadow-[0_14px_30px_rgba(16,185,129,0.25)]"
            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-400/30 hover:text-white"
        }`}
      >
        All
        {totalWaiting > 0 && (
          <span
            className={`ml-2 px-2 py-0.5 rounded-full text-xs tabular-nums border ${
              activeQueueId === null
                ? "bg-emerald-500/25 text-emerald-50 border-transparent"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {totalWaiting}
          </span>
        )}
      </button>

      {/* Individual queue tabs */}
      {queues.map((queue) => (
        <button
          key={queue.queueId}
          onClick={() => onSelectQueue(queue.queueId)}
          className={`px-4 py-2 rounded-none font-medium text-sm transition-all border ${
            activeQueueId === queue.queueId
              ? "bg-emerald-500/20 border-emerald-400/40 text-white shadow-[0_14px_30px_rgba(16,185,129,0.25)]"
              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-400/30 hover:text-white"
          }`}
        >
          {queue.name}
          {queue.waitingCount > 0 && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs tabular-nums border ${
                activeQueueId === queue.queueId
                  ? "bg-emerald-500/25 text-emerald-50 border-transparent"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {queue.waitingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/staff/components/QueueTabs.tsx
git commit -m "style: update QueueTabs to demo page design"
```

---

### Task 3: Update CustomerCard Component

**Files:**
- Modify: `src/client/src/features/staff/components/CustomerCard.tsx`

**Step 1: Apply demo page card styling**

Update to sharp corners, refined shadows, and consistent button styling.

```tsx
import { memo } from "react";
import type { Customer } from "../hooks/useStaffQueue";

interface CustomerCardProps {
  customer: Customer;
  queueName?: string;
  onMarkServed?: (id: string) => void;
  onMarkNoShow?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const CustomerCard = memo(function CustomerCard({
  customer,
  queueName,
  onMarkServed,
  onMarkNoShow,
  onRemove,
}: CustomerCardProps) {
  const isCalled = customer.status === "Called";
  const isWaiting = customer.status === "Waiting";

  return (
    <div
      className={`border rounded-none p-4 transition-all ${
        isCalled
          ? "bg-amber-500/10 border-amber-500/20 shadow-[0_12px_32px_rgba(245,158,11,0.15)]"
          : "bg-slate-900 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Position / Status indicator */}
          {isWaiting && customer.position && (
            <div className="w-12 h-12 bg-slate-800 rounded-none flex items-center justify-center font-bold text-lg text-white">
              {customer.position}
            </div>
          )}
          {isCalled && (
            <div className="w-12 h-12 bg-amber-500/20 rounded-none flex items-center justify-center">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            </div>
          )}

          {/* Customer info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{customer.name}</h3>
            <p className="text-sm text-slate-500">
              {formatTime(customer.joinedAt)}
              {customer.calledAt && ` · Called ${formatTime(customer.calledAt)}`}
            </p>

            {/* Tags */}
            {(queueName || customer.partySize || customer.notes) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {queueName && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-teal-500/20 rounded-none text-xs text-teal-400 font-medium">
                    {queueName}
                  </span>
                )}
                {customer.partySize && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 rounded-none text-xs text-slate-400">
                    Party of {customer.partySize}
                  </span>
                )}
                {customer.notes && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 rounded-none text-xs text-slate-400 italic max-w-[200px] truncate">
                    {customer.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-4">
          {isCalled && onMarkServed && (
            <button
              onClick={() => onMarkServed(customer.id)}
              className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-none hover:bg-emerald-400 transition-colors"
            >
              Done
            </button>
          )}
          {isCalled && onMarkNoShow && (
            <button
              onClick={() => onMarkNoShow(customer.id)}
              className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-medium rounded-none hover:bg-slate-600 transition-colors"
            >
              No-show
            </button>
          )}
          {isWaiting && onRemove && (
            <button
              onClick={() => onRemove(customer.id)}
              className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-none hover:bg-red-500/20 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/staff/components/CustomerCard.tsx
git commit -m "style: update CustomerCard to demo page design"
```

---

### Task 4: Update QueueControls Component

**Files:**
- Modify: `src/client/src/features/staff/components/QueueControls.tsx`

**Step 1: Apply demo page controls styling**

Update with sharp corners, gradient buttons, refined stats display.

```tsx
import type { QueueInfo } from "../hooks/useStaffQueue";

interface QueueControlsProps {
  queueInfo: QueueInfo;
  onCallNext?: () => void | Promise<unknown>;
  onOpenSettings?: () => void;
  onOpenQRCode?: () => void;
  isConnected: boolean;
  showAllControls?: boolean;
}

export function QueueControls({
  queueInfo,
  onCallNext,
  onOpenSettings,
  onOpenQRCode,
  isConnected,
  showAllControls = true,
}: QueueControlsProps) {
  const hasWaiting = queueInfo.waitingCount > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-6 shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        {/* Queue info */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-white">{queueInfo.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${queueInfo.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-[11px] text-slate-500 uppercase tracking-[0.08em]">
                {queueInfo.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {queueInfo.isPaused && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[11px] uppercase tracking-[0.08em]">Paused</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-[11px] uppercase tracking-[0.08em]">{isConnected ? "Live" : "Connecting"}</span>
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-3 rounded-none border px-4 py-2 bg-slate-800/60 border-slate-700">
            <div className="w-10 h-10 rounded-none flex items-center justify-center font-bold bg-slate-700 text-white">
              {queueInfo.waitingCount}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Waiting</p>
              <p className="text-white text-sm">In queue</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-none border px-4 py-2 bg-amber-500/10 border-amber-400/30">
            <div className="w-10 h-10 rounded-none flex items-center justify-center font-bold bg-amber-500/30 text-white">
              {queueInfo.calledCount}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-amber-300/80">Called</p>
              <p className="text-amber-100 text-sm">Awaiting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {showAllControls && onCallNext && (
          <button
            onClick={onCallNext}
            disabled={!hasWaiting}
            className="flex-1 sm:flex-none px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 rounded-none font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
          >
            Call Next
          </button>
        )}
        {!showAllControls && (
          <div className="flex-1 sm:flex-none px-8 py-4 bg-slate-800 text-slate-500 rounded-none font-medium text-center border border-slate-700">
            Select a queue to manage
          </div>
        )}
        {showAllControls && onOpenQRCode && (
          <button
            onClick={onOpenQRCode}
            className="px-6 py-4 bg-slate-800 text-white rounded-none font-medium border border-white/5 hover:border-teal-400/40 hover:bg-slate-800/80 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z" />
            </svg>
            QR Code
          </button>
        )}
        {showAllControls && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-6 py-4 bg-slate-800 text-slate-300 rounded-none font-medium border border-slate-700 hover:border-slate-600 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/staff/components/QueueControls.tsx
git commit -m "style: update QueueControls to demo page design"
```

---

### Task 5: Update QueueSelector Component (Customer)

**Files:**
- Modify: `src/client/src/features/customer/components/QueueSelector.tsx`

**Step 1: Apply demo page styling to queue selection cards**

```tsx
interface Queue {
  name: string;
  slug: string;
  waitingCount: number;
  estimatedWaitMinutes: number;
}

interface QueueSelectorProps {
  businessName: string;
  queues: Queue[];
  onSelect: (queueSlug: string) => void;
}

export function QueueSelector({ businessName, queues, onSelect }: QueueSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-teal-400 font-medium mb-2">{businessName}</p>
        <h2 className="text-2xl font-bold">Choose a queue</h2>
        <p className="text-slate-500 mt-2">Select which line you'd like to join</p>
      </div>

      <div className="space-y-3">
        {queues.map((queue) => (
          <button
            key={queue.slug}
            onClick={() => onSelect(queue.slug)}
            className="w-full p-5 bg-slate-900 border border-slate-800 rounded-none hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-white group-hover:text-teal-400 transition-colors">
                  {queue.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {queue.waitingCount} waiting
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    ~{queue.estimatedWaitMinutes} min
                  </span>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-slate-600 group-hover:text-teal-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/customer/components/QueueSelector.tsx
git commit -m "style: update QueueSelector to demo page design"
```

---

### Task 6: Update QueuePosition Component (Customer View)

**Files:**
- Modify: `src/client/src/features/customer/QueuePosition.tsx`

**Step 1: Apply demo page styling to customer waiting view**

This is the largest change - the customer-facing position display needs gradient backgrounds, refined typography, and enhanced visual hierarchy.

```tsx
import { useQueuePosition } from "./hooks/useQueuePosition";
import { usePushNotifications } from "./hooks/usePushNotifications";

function ConnectionIndicator({ state }: { state: "connecting" | "connected" | "reconnecting" | "disconnected" }) {
  const colors = {
    connected: "bg-emerald-400 animate-pulse",
    connecting: "bg-amber-400 animate-pulse",
    reconnecting: "bg-amber-400 animate-pulse",
    disconnected: "bg-red-500",
  };

  const labels = {
    connected: "Live updates active",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-white/5 border border-white/5 backdrop-blur">
      <div className={`w-2.5 h-2.5 rounded-full ${colors[state]} shadow-[0_0_0_4px_rgba(255,255,255,0.04)]`} />
      <span className="text-[11px] text-slate-200 uppercase tracking-[0.08em]">
        {labels[state]}
      </span>
    </div>
  );
}

function PositionDisplay({ position }: { position: number }) {
  return (
    <div className="relative overflow-hidden rounded-none border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-7 text-center shadow-[0_12px_34px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_30%)] blur-3xl" />
      <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-3">Your position</p>
      <div className="relative inline-flex items-baseline justify-center">
        <div className="text-8xl font-bold leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent drop-shadow-[0_10px_35px_rgba(16,185,129,0.25)]">
          {position}
        </div>
      </div>
      <p className="text-slate-300 mt-4 text-sm">
        {position === 1 ? "You're next!" : `${position - 1} ${position - 1 === 1 ? "person" : "people"} ahead of you`}
      </p>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[11px] uppercase tracking-[0.16em] mt-3 text-emerald-300/80">
        Live updates on deck
      </p>
    </div>
  );
}

function CalledCard({ message }: { message: string | null }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.18),transparent_32%)] blur-3xl" />
      <div className="relative bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-400/40 rounded-none p-7 text-center shadow-[0_14px_38px_rgba(16,185,129,0.24)]">
        <div className="w-16 h-16 rounded-none flex items-center justify-center mx-auto mb-4 bg-emerald-500/25 shadow-inner shadow-emerald-900/50">
          <svg className="w-8 h-8 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">It's your turn</h2>
        <p className="text-emerald-50/80 text-sm">{message || "Please proceed to the counter"}</p>
      </div>
    </div>
  );
}

function NearFrontBanner({ position }: { position: number }) {
  return (
    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-none flex items-center justify-center flex-shrink-0">
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

function NotificationBanner({
  isSupported,
  permission,
  isSubscribed,
  isLoading,
  onEnable,
}: {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  onEnable: () => void;
}) {
  if (!isSupported) return null;

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-none">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-none flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-emerald-300 text-sm">Notifications on — we'll alert you when called</p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-none">
        <p className="text-slate-500 text-sm">
          Notifications blocked. Enable in browser settings to get alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-teal-500/10 border border-teal-500/20 rounded-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500/20 rounded-none flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-teal-300 text-sm">Get notified when it's your turn</p>
      </div>
      <button
        onClick={onEnable}
        disabled={isLoading}
        className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-none hover:bg-teal-400 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isLoading ? "..." : "Enable"}
      </button>
    </div>
  );
}

interface QueuePositionProps {
  token: string;
}

export function QueuePosition({ token }: QueuePositionProps) {
  const { data, isLoading, error, connectionState, refresh } = useQueuePosition(token);
  const pushNotifications = usePushNotifications(token);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border border-teal-500/30" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-transparent border-t-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center border border-red-500/30 bg-red-500/5 rounded-none px-6 py-8 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="w-16 h-16 bg-red-500/20 rounded-none flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-300/80 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-white text-slate-900 font-semibold rounded-none hover:bg-slate-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isCalled = data.status === "Called";
  const isWaiting = data.status === "Waiting";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-xl font-bold">{data.businessName}</h1>
            <p className="text-slate-500">{data.queueName}</p>
          </div>
          <ConnectionIndicator state={connectionState} />
        </div>

        {/* Near-front alert */}
        {data.nearFrontAlert && data.position && data.position > 0 && (
          <NearFrontBanner position={data.position} />
        )}

        {/* Main status */}
        <div className="mb-8">
          {isCalled ? (
            <CalledCard message={data.calledMessage} />
          ) : isWaiting && data.position ? (
            <PositionDisplay position={data.position} />
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-none p-6 text-center">
              <p className="text-slate-400">Status: {data.status}</p>
            </div>
          )}
        </div>

        {/* Notification banner */}
        {isWaiting && (
          <div className="mb-4">
            <NotificationBanner
              isSupported={pushNotifications.isSupported}
              permission={pushNotifications.permission}
              isSubscribed={pushNotifications.isSubscribed}
              isLoading={pushNotifications.isLoading}
              onEnable={pushNotifications.subscribe}
            />
          </div>
        )}

        {/* Welcome message */}
        {data.welcomeMessage && isWaiting && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-none">
            <p className="text-slate-400 text-sm">{data.welcomeMessage}</p>
          </div>
        )}

        {/* Offline refresh */}
        {connectionState === "disconnected" && (
          <button
            onClick={refresh}
            className="w-full mt-4 py-4 bg-slate-800 text-white font-medium rounded-none border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            Refresh Position
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/customer/QueuePosition.tsx
git commit -m "style: update QueuePosition to demo page design"
```

---

### Task 7: Update JoinQueue Component

**Files:**
- Modify: `src/client/src/features/customer/JoinQueue.tsx`

**Step 1: Apply demo page styling to join form**

Update form inputs, buttons, and cards to match demo page aesthetic.

Key changes:
- Replace `rounded-2xl`, `rounded-3xl`, `rounded-xl` with `rounded-none`
- Update button styling with gradient for primary actions
- Add refined shadows to cards

Search and replace in the file:
- `rounded-3xl` → `rounded-none`
- `rounded-2xl` → `rounded-none`
- `rounded-xl` → `rounded-none`

Additionally update the submit button to use the gradient style:
```tsx
// Change the submit button from:
className="w-full py-4 bg-white text-slate-900 font-semibold rounded-2xl hover:bg-slate-100 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"

// To:
className="w-full py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
```

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/customer/JoinQueue.tsx
git commit -m "style: update JoinQueue to demo page design"
```

---

### Task 8: Update StaffDashboard Component

**Files:**
- Modify: `src/client/src/features/staff/StaffDashboard.tsx`

**Step 1: Apply demo page styling throughout dashboard**

Update all rounded corners and button styles throughout the component.

Key changes (search and replace):
- `rounded-3xl` → `rounded-none`
- `rounded-2xl` → `rounded-none`
- `rounded-xl` → `rounded-none`

Update specific button styles:
- Primary buttons get gradient: `bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950`
- Add shadow to action buttons: `shadow-[0_14px_30px_rgba(16,185,129,0.28)]`

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/staff/StaffDashboard.tsx
git commit -m "style: update StaffDashboard to demo page design"
```

---

### Task 9: Update QRCodeModal Component

**Files:**
- Modify: `src/client/src/features/staff/components/QRCodeModal.tsx`

**Step 1: Read the current file and apply demo styling**

Update modal container and buttons to match demo page.

**Step 2: Run tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/client/src/features/staff/components/QRCodeModal.tsx
git commit -m "style: update QRCodeModal to demo page design"
```

---

### Task 10: Final Verification

**Step 1: Run all tests**

Run: `cd .worktrees/ui-improvements/src/client && npm test -- --run`
Expected: All 74+ tests pass

**Step 2: Run TypeScript check**

Run: `cd .worktrees/ui-improvements/src/client && npx tsc --noEmit`
Expected: No errors

**Step 3: Run linting**

Run: `cd .worktrees/ui-improvements/src/client && npm run lint`
Expected: No errors

**Step 4: Manual visual verification**

Start the dev server and verify each page:
1. `/demo` - Reference (should look the same)
2. `/q/[token]` - Customer position view
3. `/staff/demo-shop` - Staff dashboard
4. `/join/demo-shop` - Join queue form

Run: `cd .worktrees/ui-improvements/src/client && npm run dev`

**Step 5: Final commit**

If all looks good, the branch is ready for PR.

```bash
git status
git log --oneline -10
```
