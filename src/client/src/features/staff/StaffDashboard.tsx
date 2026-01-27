import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { safeJsonParse } from "../../shared/utils/api";
import { useStaffQueue } from "./hooks/useStaffQueue";
import { CustomerCard } from "./components/CustomerCard";
import { QueueControls } from "./components/QueueControls";
import { QueueSettings } from "./QueueSettings";
import { QRCodeModal } from "./components/QRCodeModal";
import { DashboardSkeleton } from "../../shared/components/Skeleton";

const API_BASE = import.meta.env.VITE_API_URL || "";

function EmptyQueueState({ onSeedDemo }: { onSeedDemo: () => void }) {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDemo = useCallback(async () => {
    setIsSeeding(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/seed`, { method: "POST" });
      if (response.ok) {
        onSeedDemo();
      }
    } catch (err) {
      console.error("Failed to seed demo data:", err);
    } finally {
      setIsSeeding(false);
    }
  }, [onSeedDemo]);

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
  const [queueId, setQueueId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(true);

  // Fetch queue ID from business slug
  useEffect(() => {
    async function fetchQueueId() {
      if (!businessSlug) return;

      try {
        const response = await fetch(`${API_BASE}/api/business/${businessSlug}/queue`);

        if (!response.ok) {
          if (response.status === 404) {
            navigate("/404");
            return;
          }
          throw new Error("Failed to load queue");
        }

        const data = await safeJsonParse<{ queueId: string }>(response);
        console.log("Queue response:", data);
        if (!data?.queueId) {
          console.error("Invalid queue response - queueId missing:", data);
          throw new Error("Invalid queue response");
        }
        setQueueId(data.queueId);
      } catch (error) {
        console.error("Failed to fetch queue:", error);
        navigate("/404");
      } finally {
        setLoadingQueue(false);
      }
    }

    fetchQueueId();
  }, [businessSlug, navigate]);

  if (loadingQueue || !queueId) {
    return <DashboardSkeleton />;
  }

  return (
    <StaffDashboardContent
      queueId={queueId}
      businessSlug={businessSlug || ""}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      showQRCode={showQRCode}
      setShowQRCode={setShowQRCode}
    />
  );
}

interface StaffDashboardContentProps {
  queueId: string;
  businessSlug: string;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showQRCode: boolean;
  setShowQRCode: (show: boolean) => void;
}

function StaffDashboardContent({
  queueId,
  businessSlug,
  showSettings,
  setShowSettings,
  showQRCode,
  setShowQRCode,
}: StaffDashboardContentProps) {
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
  } = useStaffQueue(queueId);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!queueInfo) {
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
  const calledCustomers = customers.filter((c) => c.status === "Called");
  const waitingCustomers = customers.filter((c) => c.status === "Waiting");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <QueueSettings queueId={queueId} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && queueInfo && (
        <QRCodeModal businessSlug={businessSlug} queueName={queueInfo.name} onClose={() => setShowQRCode(false)} />
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Controls */}
        <QueueControls
          queueInfo={queueInfo}
          onCallNext={callNext}
          onOpenSettings={() => setShowSettings(true)}
          onOpenQRCode={() => setShowQRCode(true)}
          isConnected={connectionState === "connected"}
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
              {calledCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onMarkServed={markServed}
                  onMarkNoShow={markNoShow}
                />
              ))}
            </div>
          </section>
        )}

        {/* Waiting customers section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Waiting ({waitingCustomers.length})
          </h2>
          {waitingCustomers.length === 0 && calledCustomers.length === 0 ? (
            <EmptyQueueState onSeedDemo={refresh} />
          ) : waitingCustomers.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
              No customers waiting.
            </div>
          ) : (
            <div className="space-y-3">
              {waitingCustomers.map((customer) => (
                <CustomerCard key={customer.id} customer={customer} onRemove={removeCustomer} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
