import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { safeJsonParse } from "../../shared/utils/api";
import { type Customer, type QueueInfo as HookQueueInfo, useStaffQueue } from "./hooks/useStaffQueue";
import { CustomerCard } from "./components/CustomerCard";
import { QueueControls } from "./components/QueueControls";
import { QueueSettings } from "./QueueSettings";
import { QRCodeModal } from "./components/QRCodeModal";
import { QRCodeDisplay } from "../../shared/components/QRCodeDisplay";
import { QueueTabs } from "./components/QueueTabs";
import { DashboardSkeleton } from "../../shared/components/Skeleton";
import { UserMenu } from "../auth/components/UserMenu";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface QueueInfo {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
  estimatedWaitMinutes: number;
}

interface QueuesResponse {
  businessId: string;
  businessName: string;
  queues: QueueInfo[];
}

function EmptyQueueState({ onSeedDemo, queueId }: { onSeedDemo: () => void; queueId?: string }) {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDemo = useCallback(async () => {
    setIsSeeding(true);
    try {
      const url = queueId ? `${API_BASE}/api/demo/seed?queueId=${queueId}` : `${API_BASE}/api/demo/seed`;
      const response = await fetch(url, { method: "POST" });
      if (response.ok) {
        onSeedDemo();
      }
    } catch (err) {
      console.error("Failed to seed demo data:", err);
    } finally {
      setIsSeeding(false);
    }
  }, [onSeedDemo, queueId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <p className="text-slate-400 mb-6">No customers in queue yet</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={handleSeedDemo}
          disabled={isSeeding}
          className="px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSeeding ? "Adding..." : "Add Demo Customers"}
        </button>
        <span className="text-slate-600 self-center">or share your QR code</span>
      </div>
    </div>
  );
}

interface StaffDashboardProps {
  businessSlug: string;
}

export function StaffDashboard({ businessSlug }: StaffDashboardProps) {
  const router = useRouter();
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [businessName, setBusinessName] = useState<string>("");
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // Fetch all queues for business
  useEffect(() => {
    async function fetchQueues() {
      if (!businessSlug) return;

      try {
        const response = await fetch(`${API_BASE}/api/business/${businessSlug}/queues`);

        if (!response.ok) {
          if (response.status === 404) {
            notFound();
            return;
          }
          throw new Error("Failed to load queues");
        }

        const data = await safeJsonParse<QueuesResponse>(response);
        if (!data?.queues) {
          throw new Error("Invalid queues response");
        }

        setQueues(data.queues);
        setBusinessName(data.businessName);

        // If only one queue, auto-select it
        if (data.queues.length === 1) {
          setActiveQueueId(data.queues[0].queueId);
        }
      } catch (error) {
        console.error("Failed to fetch queues:", error);
        notFound();
      } finally {
        setLoadingQueues(false);
      }
    }

    fetchQueues();
  }, [businessSlug, router]);

  if (loadingQueues) {
    return <DashboardSkeleton />;
  }

  if (queues.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-400">No queues available</p>
          <p className="mt-2 text-slate-500">This business has no active queues.</p>
        </div>
      </div>
    );
  }

  return (
    <MultiQueueDashboard
      queues={queues}
      businessSlug={businessSlug || ""}
      businessName={businessName}
      activeQueueId={activeQueueId}
      onSelectQueue={setActiveQueueId}
    />
  );
}

interface MultiQueueDashboardProps {
  queues: QueueInfo[];
  businessSlug: string;
  businessName: string;
  activeQueueId: string | null;
  onSelectQueue: (queueId: string | null) => void;
}

function MultiQueueDashboard({
  queues: initialQueues,
  businessSlug,
  businessName,
  activeQueueId,
  onSelectQueue,
}: MultiQueueDashboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Track queue counts separately for tabs - updated when active queue changes
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialQueues.map((q) => [q.queueId, q.waitingCount])),
  );

  // For "All" view, we fetch all customers separately
  const [allViewCustomers, setAllViewCustomers] = useState<(Customer & { queueName: string; queueId: string })[]>([]);
  const [allViewLoading, setAllViewLoading] = useState(false);
  // Track whether All view data has been fetched (cache invalidated by SignalR or manual refresh)
  const allViewFetchedRef = useRef(false);

  // Get the selected queue info
  const selectedQueue = activeQueueId ? initialQueues.find((q) => q.queueId === activeQueueId) : null;

  // For single queue, use the queue directly. For "All" view, use first queue for the hook (but we won't display its data)
  const primaryQueueId = activeQueueId || initialQueues[0].queueId;

  // Use SINGLE staff queue hook - only for the active queue
  const { customers, queueInfo, isLoading, error, connectionState, refresh, callNext } = useStaffQueue(primaryQueueId);

  // Update queue counts when active queue data changes
  // Also invalidate All view cache when data changes (SignalR update)
  useEffect(() => {
    if (queueInfo && activeQueueId) {
      const waitingCount = customers.filter((c) => c.status === "Waiting").length;
      setQueueCounts((prev) => {
        if (prev[activeQueueId] === waitingCount) return prev;
        // Invalidate All view cache since queue data changed
        allViewFetchedRef.current = false;
        return { ...prev, [activeQueueId]: waitingCount };
      });
    }
  }, [queueInfo, customers, activeQueueId]);

  // Fetch all customers when "All" view is selected (with caching)
  useEffect(() => {
    // Skip if not in All view or only one queue
    if (activeQueueId !== null || initialQueues.length <= 1) return;

    // Skip if we already have cached data
    if (allViewFetchedRef.current && allViewCustomers.length > 0) return;

    let cancelled = false;

    async function fetchAllQueues() {
      setAllViewLoading(true);
      try {
        const allCustomers: (Customer & { queueName: string; queueId: string })[] = [];
        const newCounts: Record<string, number> = {};

        // Fetch all queues in parallel
        const responses = await Promise.all(
          initialQueues.map((q) => fetch(`/api/queues/${q.queueId}/customers`).then((r) => (r.ok ? r.json() : null))),
        );

        if (cancelled) return;

        responses.forEach((data, index) => {
          if (data?.customers) {
            const queue = initialQueues[index];
            newCounts[queue.queueId] = data.customers.filter((c: Customer) => c.status === "Waiting").length;
            data.customers.forEach((c: Customer) => {
              allCustomers.push({ ...c, queueName: queue.name, queueId: queue.queueId });
            });
          }
        });

        // Sort by joinedAt
        allCustomers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

        setAllViewCustomers(allCustomers);
        setQueueCounts((prev) => ({ ...prev, ...newCounts }));
        allViewFetchedRef.current = true;
      } catch (err) {
        console.error("Failed to fetch all queues:", err);
      } finally {
        if (!cancelled) setAllViewLoading(false);
      }
    }

    fetchAllQueues();
    return () => {
      cancelled = true;
    };
  }, [activeQueueId, initialQueues, allViewCustomers.length]);

  // Build tab data from tracked counts
  const queueTabsData = useMemo(
    () =>
      initialQueues.map((q) => ({
        queueId: q.queueId,
        name: q.name,
        slug: q.slug,
        waitingCount: queueCounts[q.queueId] ?? q.waitingCount,
      })),
    [initialQueues, queueCounts],
  );

  // Get customers based on active view
  const displayCustomers = useMemo(() => {
    if (activeQueueId === null && initialQueues.length > 1) {
      return allViewCustomers;
    }
    return customers.map((c) => ({ ...c, queueName: queueInfo?.name || "", queueId: primaryQueueId }));
  }, [activeQueueId, initialQueues.length, allViewCustomers, customers, queueInfo, primaryQueueId]);

  // Action handler for customers - routes to correct API endpoint
  const handleAction = useCallback(
    async (action: "serve" | "no-show" | "remove", customerId: string, queueId: string): Promise<boolean> => {
      try {
        const endpoints: Record<string, string> = {
          serve: `/api/queues/${queueId}/customers/${customerId}/serve`,
          "no-show": `/api/queues/${queueId}/customers/${customerId}/no-show`,
          remove: `/api/queues/${queueId}/customers/${customerId}`,
        };

        const response = await fetch(endpoints[action], {
          method: action === "remove" ? "DELETE" : "POST",
        });

        if (!response.ok) return false;

        // If in "All" view, update local state immediately
        if (activeQueueId === null) {
          setAllViewCustomers((prev) => prev.filter((c) => c.id !== customerId));
          setQueueCounts((prev) => ({
            ...prev,
            [queueId]: Math.max(0, (prev[queueId] ?? 0) - 1),
          }));
        } else {
          // Let the hook refresh handle it
          await refresh();
        }

        return true;
      } catch {
        return false;
      }
    },
    [activeQueueId, refresh],
  );

  // Get the active queue info for controls
  const activeQueueInfo = useMemo((): HookQueueInfo | null => {
    if (activeQueueId === null) {
      const totalWaiting = Object.values(queueCounts).reduce((sum, count) => sum + count, 0);
      return {
        name: businessName,
        isActive: true,
        isPaused: false,
        waitingCount: totalWaiting,
        calledCount: allViewCustomers.filter((c) => c.status === "Called").length,
      };
    }
    return queueInfo;
  }, [activeQueueId, queueInfo, queueCounts, allViewCustomers, businessName]);

  const effectiveLoading = activeQueueId === null ? allViewLoading : isLoading;

  if (effectiveLoading) {
    return <DashboardSkeleton />;
  }

  if (!activeQueueInfo) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-400">Failed to load queue</p>
          <p className="mt-2 text-slate-500">{error || "Please try again later."}</p>
        </div>
      </div>
    );
  }

  // Separate customers by status
  const calledCustomers = displayCustomers.filter((c) => c.status === "Called");
  const waitingCustomers = displayCustomers.filter((c) => c.status === "Waiting");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Settings Modal */}
      {showSettings && activeQueueId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <QueueSettings queueId={activeQueueId} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && selectedQueue && (
        <QRCodeModal
          businessSlug={businessSlug}
          queueSlug={selectedQueue.slug}
          queueName={selectedQueue.name}
          onClose={() => setShowQRCode(false)}
        />
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header with business name and user menu */}
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{businessName}</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-xl hover:border-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QR Code
            </button>
            <UserMenu />
          </div>
        </header>

        {/* Queue Tabs - only show if multiple queues */}
        {initialQueues.length > 1 && (
          <MemoizedQueueTabs queues={queueTabsData} activeQueueId={activeQueueId} onSelectQueue={onSelectQueue} />
        )}

        {/* Inline QR Code Display */}
        {showQR && (
          <div className="mb-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl">
            <h3 className="text-lg font-semibold mb-4 text-center">Queue Join Link</h3>
            <QRCodeDisplay
              url={`${window.location.origin}/join/${businessSlug}`}
              title="Scan to join queue"
            />
            <p className="text-xs text-slate-500 text-center mt-4">
              {window.location.origin}/join/{businessSlug}
            </p>
          </div>
        )}

        {/* Controls */}
        <QueueControls
          queueInfo={activeQueueInfo}
          onCallNext={activeQueueId !== null ? callNext : undefined}
          onOpenSettings={activeQueueId !== null ? () => setShowSettings(true) : undefined}
          onOpenQRCode={activeQueueId !== null ? () => setShowQRCode(true) : undefined}
          isConnected={connectionState === "connected"}
          showAllControls={activeQueueId !== null}
        />

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl">{error}</div>
        )}

        {/* Called customers section */}
        {calledCustomers.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Called — Awaiting</h2>
            <div className="space-y-3">
              {calledCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  queueName={activeQueueId === null ? customer.queueName : undefined}
                  onMarkServed={(id) => handleAction("serve", id, customer.queueId)}
                  onMarkNoShow={(id) => handleAction("no-show", id, customer.queueId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Waiting customers section */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
            Waiting ({waitingCustomers.length})
          </h2>
          {waitingCustomers.length === 0 && calledCustomers.length === 0 ? (
            <EmptyQueueState onSeedDemo={refresh} queueId={primaryQueueId} />
          ) : waitingCustomers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No customers waiting.
            </div>
          ) : (
            <div className="space-y-3">
              {waitingCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  queueName={activeQueueId === null ? customer.queueName : undefined}
                  onRemove={(id) => handleAction("remove", id, customer.queueId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Memoized QueueTabs to prevent re-renders when counts haven't changed
const MemoizedQueueTabs = memo(QueueTabs);
