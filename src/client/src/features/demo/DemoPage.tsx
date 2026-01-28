import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { safeJsonParse } from "../../shared/utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface QueueInfo {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
}

interface QueuesResponse {
  businessId: string;
  businessName: string;
  queues: QueueInfo[];
}

type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

function ConnectionIndicator({ state }: { state: ConnectionState }): JSX.Element {
  const colors = {
    connected: "bg-emerald-500",
    connecting: "bg-amber-500 animate-pulse",
    reconnecting: "bg-amber-500 animate-pulse",
    disconnected: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[state]}`} />
      <span className="text-xs text-zinc-500 uppercase tracking-wide">
        {state === "connected" ? "Live" : state}
      </span>
    </div>
  );
}

function LoadingSpinner(): JSX.Element {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );
}

interface ErrorDisplayProps {
  message: string;
  onRetry: () => void;
}

function ErrorDisplay({ message, onRetry }: ErrorDisplayProps): JSX.Element {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-zinc-500 mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  variant: "staff" | "customer";
  children: React.ReactNode;
}

function Panel({ title, variant, children }: PanelProps): JSX.Element {
  const bgClass = variant === "staff" ? "bg-zinc-900" : "bg-zinc-900/70";

  return (
    <div className={`flex-1 ${bgClass} border border-zinc-800 rounded-2xl p-6 min-h-[400px]`}>
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

export function DemoPage(): JSX.Element {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [businessName, setBusinessName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const fetchQueues = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/business/demo-shop/queues`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Demo shop not found. Please ensure the demo data is seeded.");
        }
        throw new Error("Failed to load queue data");
      }

      const data = await safeJsonParse<QueuesResponse>(response);
      if (!data?.queues) {
        throw new Error("Invalid queue data received");
      }

      setQueues(data.queues);
      setBusinessName(data.businessName);
      setConnectionState("connected");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setConnectionState("disconnected");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchQueues} />;
  }

  const primaryQueue = queues[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <div className="w-px h-6 bg-zinc-800" />
            <div>
              <h1 className="text-xl font-bold">Interactive Demo</h1>
              <p className="text-sm text-zinc-500">{businessName}</p>
            </div>
          </div>
          <ConnectionIndicator state={connectionState} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Description */}
        <div className="mb-8 p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
          <p className="text-violet-300 text-sm">
            This demo shows both staff and customer views side-by-side. Click "Call Next" on the staff
            panel and watch both views update in real-time via SignalR.
          </p>
        </div>

        {/* Split layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Staff Panel */}
          <Panel title="Staff Dashboard" variant="staff">
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <svg
                className="w-12 h-12 mb-4 text-zinc-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-sm">Staff controls will appear here</p>
              {primaryQueue && (
                <p className="text-xs text-zinc-600 mt-2">
                  Queue: {primaryQueue.name} ({primaryQueue.waitingCount} waiting)
                </p>
              )}
            </div>
          </Panel>

          {/* Customer Panel */}
          <Panel title="Customer View" variant="customer">
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <svg
                className="w-12 h-12 mb-4 text-zinc-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-sm">Customer position will appear here</p>
              <p className="text-xs text-zinc-600 mt-2">Real-time updates via SignalR</p>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
