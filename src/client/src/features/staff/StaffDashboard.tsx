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
import { useAuth } from "../auth/hooks/useAuth";

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

function EmptyQueueState({ onShowQRCode }: { onShowQRCode: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-8 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-none flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">No customers in queue</h3>
      <p className="text-slate-400 mb-6">Share your QR code to let customers join</p>
      <button
        onClick={onShowQRCode}
        className="px-6 py-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)] inline-flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        Show QR Code
      </button>
    </div>
  );
}

interface AddQueueModalProps {
  businessSlug: string;
  token: string | null;
  onClose: () => void;
  onQueueCreated: (queue: QueueInfo) => void;
}

function AddQueueModal({ businessSlug, token, onClose, onQueueCreated }: AddQueueModalProps) {
  const [queueName, setQueueName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!queueName.trim() || !token) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/business/${businessSlug}/queues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: queueName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create queue");
      }

      const data = await response.json();
      onQueueCreated({
        queueId: data.id,
        name: data.name,
        slug: data.slug,
        waitingCount: 0,
        estimatedWaitMinutes: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create queue");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-none p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add New Queue</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label htmlFor="newQueueName" className="block text-sm font-medium text-slate-400 mb-2">
          Queue name
        </label>
        <input
          id="newQueueName"
          type="text"
          value={queueName}
          onChange={(e) => setQueueName(e.target.value)}
          placeholder="e.g., Takeout, Bar, VIP"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all mb-4"
          autoFocus
        />

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-none text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-slate-400 font-medium rounded-none border border-slate-700 hover:border-slate-600 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !queueName.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)] flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              "Create Queue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NoQueuesStateProps {
  businessSlug: string;
  businessName: string;
  isOwner: boolean;
  onQueueCreated: (queue: QueueInfo) => void;
}

function NoQueuesState({ businessSlug, businessName, isOwner, onQueueCreated }: NoQueuesStateProps) {
  const { token } = useAuth();
  const [queueName, setQueueName] = useState("Main Queue");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!queueName.trim()) return;

    // In dev mode, allow creating without auth token
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !token) return;

    setIsCreating(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Use dev endpoint in development mode (no auth required)
      const endpoint = isDev && !token
        ? `/api/demo/business/${businessSlug}/queues`
        : `/api/business/${businessSlug}/queues`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: queueName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create queue");
      }

      const data = await response.json();
      onQueueCreated({
        queueId: data.id,
        name: data.name,
        slug: data.slug,
        waitingCount: 0,
        estimatedWaitMinutes: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create queue");
    } finally {
      setIsCreating(false);
    }
  };

  // Staff sees a different view - they can't create queues
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-800 rounded-none flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">{businessName || "Your Business"}</h1>
            <p className="text-slate-400 mt-2">Contact your business owner to create a queue</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-none p-6 text-center">
            <p className="text-slate-400">
              No queues have been set up yet. As a staff member, you&apos;ll be able to manage customers once a queue is created.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-none flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">{businessName || "Your Business"}</h1>
          <p className="text-slate-400 mt-2">Create your first queue to get started</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-none p-6">
          <label htmlFor="queueName" className="block text-sm font-medium text-slate-400 mb-2">
            Queue name
          </label>
          <input
            id="queueName"
            type="text"
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
            placeholder="e.g., Main Queue, Takeout, Bar"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all mb-4"
          />

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-none text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || !queueName.trim()}
            className="w-full py-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)] flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Queue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StaffDashboardProps {
  businessSlug: string;
}

export function StaffDashboard({ businessSlug }: StaffDashboardProps) {
  const router = useRouter();
  const { isOwner } = useAuth();
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
      <NoQueuesState
        businessSlug={businessSlug}
        businessName={businessName}
        isOwner={isOwner(businessSlug)}
        onQueueCreated={(queue) => {
          setQueues([queue]);
          setActiveQueueId(queue.queueId);
        }}
      />
    );
  }

  return (
    <MultiQueueDashboard
      queues={queues}
      businessSlug={businessSlug || ""}
      businessName={businessName}
      activeQueueId={activeQueueId}
      onSelectQueue={setActiveQueueId}
      isOwner={isOwner(businessSlug)}
      onQueueCreated={(queue) => {
        setQueues((prev) => [...prev, queue]);
        setActiveQueueId(queue.queueId);
      }}
    />
  );
}

interface MultiQueueDashboardProps {
  queues: QueueInfo[];
  businessSlug: string;
  businessName: string;
  activeQueueId: string | null;
  onSelectQueue: (queueId: string | null) => void;
  isOwner: boolean;
  onQueueCreated: (queue: QueueInfo) => void;
}

function MultiQueueDashboard({
  queues: initialQueues,
  businessSlug,
  businessName,
  activeQueueId,
  onSelectQueue,
  isOwner,
  onQueueCreated,
}: MultiQueueDashboardProps) {
  const { token } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showAddQueue, setShowAddQueue] = useState(false);

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

      {/* Add Queue Modal */}
      {showAddQueue && (
        <AddQueueModal
          businessSlug={businessSlug}
          token={token}
          onClose={() => setShowAddQueue(false)}
          onQueueCreated={(queue) => {
            onQueueCreated(queue);
            setShowAddQueue(false);
          }}
        />
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header with business name and user menu */}
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{businessName}</h1>
          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                onClick={() => setShowAddQueue(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-teal-400 hover:text-teal-300 border border-teal-700 rounded-none hover:border-teal-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Queue
              </button>
            )}
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-none hover:border-slate-600 transition-colors"
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
          <div className="mb-6 p-6 bg-slate-900 border border-slate-800 rounded-none">
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
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-none">{error}</div>
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
            <EmptyQueueState onShowQRCode={() => setShowQRCode(true)} />
          ) : waitingCustomers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-none p-8 text-center text-slate-500">
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
