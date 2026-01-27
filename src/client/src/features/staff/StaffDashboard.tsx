import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { safeJsonParse } from "../../shared/utils/api";
import { type Customer, useStaffQueue } from "./hooks/useStaffQueue";
import { CustomerCard } from "./components/CustomerCard";
import { QueueControls } from "./components/QueueControls";
import { QueueSettings } from "./QueueSettings";
import { QRCodeModal } from "./components/QRCodeModal";
import { QueueTabs } from "./components/QueueTabs";
import { DashboardSkeleton } from "../../shared/components/Skeleton";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <p className="text-zinc-400 mb-6">No customers in queue yet</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={handleSeedDemo}
          disabled={isSeeding}
          className="px-6 py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSeeding ? "Adding..." : "Add Demo Customers"}
        </button>
        <span className="text-zinc-600 self-center">or share your QR code</span>
      </div>
    </div>
  );
}

export function StaffDashboard() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const navigate = useNavigate();
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
            navigate("/404");
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
        navigate("/404");
      } finally {
        setLoadingQueues(false);
      }
    }

    fetchQueues();
  }, [businessSlug, navigate]);

  if (loadingQueues) {
    return <DashboardSkeleton />;
  }

  if (queues.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-400">No queues available</p>
          <p className="mt-2 text-zinc-500">This business has no active queues.</p>
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
  queues,
  businessSlug,
  businessName,
  activeQueueId,
  onSelectQueue,
}: MultiQueueDashboardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // Get the selected queue info
  const selectedQueue = activeQueueId ? queues.find((q) => q.queueId === activeQueueId) : null;

  // For single queue, use the queue directly
  const primaryQueueId = queues.length === 1 ? queues[0].queueId : activeQueueId || queues[0].queueId;

  // Use the staff queue hook for the primary/active queue
  const {
    customers,
    queueInfo,
    isLoading,
    error,
    connectionState,
    refresh,
    callNext,
    markServed,
    markNoShow,
    removeCustomer,
  } = useStaffQueue(primaryQueueId);

  // Also get data for other queues if showing "All"
  const queue2Hook = useStaffQueue(queues.length > 1 ? queues[1].queueId : queues[0].queueId);
  const queue3Hook = useStaffQueue(queues.length > 2 ? queues[2].queueId : queues[0].queueId);

  // Build combined queue data for tabs
  const queueTabsData = useMemo(() => {
    const tabData = queues.map((q, index) => {
      let waitingCount = 0;
      if (index === 0 && queueInfo) {
        waitingCount = customers.filter((c) => c.status === "Waiting").length;
      } else if (index === 1 && queue2Hook.queueInfo) {
        waitingCount = queue2Hook.customers.filter((c) => c.status === "Waiting").length;
      } else if (index === 2 && queue3Hook.queueInfo) {
        waitingCount = queue3Hook.customers.filter((c) => c.status === "Waiting").length;
      }
      return {
        queueId: q.queueId,
        name: q.name,
        slug: q.slug,
        waitingCount,
      };
    });
    return tabData;
  }, [
    queues,
    queueInfo,
    customers,
    queue2Hook.queueInfo,
    queue2Hook.customers,
    queue3Hook.queueInfo,
    queue3Hook.customers,
  ]);

  // Get customers based on active view
  // In "All" view, we add queueId so actions can be routed to the correct queue
  const displayCustomers = useMemo(() => {
    if (activeQueueId === null && queues.length > 1) {
      // "All" view - combine customers from all queues
      const allCustomers: (Customer & { queueName: string; queueId: string })[] = [];

      queues.forEach((q, index) => {
        let queueCustomers: Customer[] = [];
        if (index === 0) {
          queueCustomers = customers;
        } else if (index === 1) {
          queueCustomers = queue2Hook.customers;
        } else if (index === 2) {
          queueCustomers = queue3Hook.customers;
        }
        queueCustomers.forEach((c) => {
          allCustomers.push({ ...c, queueName: q.name, queueId: q.queueId });
        });
      });

      // Sort by joinedAt
      return allCustomers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
    }

    // Single queue view - use primaryQueueId for the queueId
    return customers.map((c) => ({ ...c, queueName: queueInfo?.name || "", queueId: primaryQueueId }));
  }, [activeQueueId, queues, customers, queueInfo, queue2Hook.customers, queue3Hook.customers, primaryQueueId]);

  // Create action functions that route to the correct queue's hook
  // This is ONLY needed for "All" view where customers from different queues are shown
  // When viewing a specific queue, the main hook is used and we should use its actions
  const getActionsForQueue = useCallback(
    (queueId: string) => {
      // If viewing a specific queue (not "All"), always use main hook actions
      // since the main hook is the one providing the customer data
      if (activeQueueId !== null) {
        return { markServed, markNoShow, removeCustomer };
      }

      // In "All" view, route to the correct hook based on which queue the customer belongs to
      const queueIndex = queues.findIndex((q) => q.queueId === queueId);
      if (queueIndex === 0) {
        return { markServed, markNoShow, removeCustomer };
      } else if (queueIndex === 1) {
        return {
          markServed: queue2Hook.markServed,
          markNoShow: queue2Hook.markNoShow,
          removeCustomer: queue2Hook.removeCustomer,
        };
      } else if (queueIndex === 2) {
        return {
          markServed: queue3Hook.markServed,
          markNoShow: queue3Hook.markNoShow,
          removeCustomer: queue3Hook.removeCustomer,
        };
      }
      // Fallback to main hook
      return { markServed, markNoShow, removeCustomer };
    },
    [
      activeQueueId,
      queues,
      markServed,
      markNoShow,
      removeCustomer,
      queue2Hook.markServed,
      queue2Hook.markNoShow,
      queue2Hook.removeCustomer,
      queue3Hook.markServed,
      queue3Hook.markNoShow,
      queue3Hook.removeCustomer,
    ],
  );

  // Actions for queue-level operations (like callNext)
  const activeQueueActions = useMemo(() => {
    return { callNext, refresh };
  }, [callNext, refresh]);

  // Get the active queue info for controls
  const activeQueueInfo = useMemo(() => {
    if (activeQueueId === null) {
      // In "All" view, show combined stats
      const totalWaiting = queueTabsData.reduce((sum, q) => sum + q.waitingCount, 0);
      return {
        name: businessName,
        isActive: true,
        isPaused: false,
        waitingCount: totalWaiting,
        calledCount: displayCustomers.filter((c) => c.status === "Called").length,
      };
    }

    // When a specific queue is selected, primaryQueueId equals activeQueueId
    // so the main hook (queueInfo) has the correct data
    return queueInfo;
  }, [activeQueueId, queueInfo, queueTabsData, displayCustomers, businessName]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!activeQueueInfo) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-400">Failed to load queue</p>
          <p className="mt-2 text-zinc-500">{error || "Please try again later."}</p>
        </div>
      </div>
    );
  }

  // Separate customers by status
  const calledCustomers = displayCustomers.filter((c) => c.status === "Called");
  const waitingCustomers = displayCustomers.filter((c) => c.status === "Waiting");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
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
        {/* Queue Tabs - only show if multiple queues */}
        {queues.length > 1 && (
          <QueueTabs queues={queueTabsData} activeQueueId={activeQueueId} onSelectQueue={onSelectQueue} />
        )}

        {/* Controls */}
        <QueueControls
          queueInfo={activeQueueInfo}
          onCallNext={activeQueueId !== null ? activeQueueActions.callNext : async () => false}
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
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Called — Awaiting</h2>
            <div className="space-y-3">
              {calledCustomers.map((customer) => {
                const actions = getActionsForQueue(customer.queueId);
                return (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    queueName={activeQueueId === null ? customer.queueName : undefined}
                    onMarkServed={actions.markServed}
                    onMarkNoShow={actions.markNoShow}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Waiting customers section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Waiting ({waitingCustomers.length})
          </h2>
          {waitingCustomers.length === 0 && calledCustomers.length === 0 ? (
            <EmptyQueueState onSeedDemo={activeQueueActions.refresh} queueId={primaryQueueId} />
          ) : waitingCustomers.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
              No customers waiting.
            </div>
          ) : (
            <div className="space-y-3">
              {waitingCustomers.map((customer) => {
                const actions = getActionsForQueue(customer.queueId);
                return (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    queueName={activeQueueId === null ? customer.queueName : undefined}
                    onRemove={actions.removeCustomer}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
