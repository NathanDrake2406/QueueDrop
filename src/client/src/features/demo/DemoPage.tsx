import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, safeJsonParse } from "../../shared/utils/api";
import { useSignalR, type ConnectionState } from "../../shared/hooks/useSignalR";

const API_BASE = import.meta.env.VITE_API_URL || "";
const SIGNALR_HUB_URL = `${API_BASE}/hubs/queue`;

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

interface Customer {
  id: string;
  name: string;
  token: string;
  status: string;
  position: number | null;
  joinedAt: string;
  calledAt: string | null;
  partySize: number | null;
  notes: string | null;
}

interface QueueData {
  queueId: string;
  queueName: string;
  customers: Customer[];
  waitingCount: number;
  calledCount: number;
}

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const colors = {
    connected: "bg-emerald-500 animate-pulse",
    connecting: "bg-amber-500 animate-pulse",
    reconnecting: "bg-amber-500 animate-pulse",
    disconnected: "bg-red-500",
  };

  const labels = {
    connected: "Live updates active",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[state]}`} />
      <span className="text-xs text-zinc-500 uppercase tracking-wide">
        {labels[state]}
      </span>
    </div>
  );
}

function LoadingSpinner() {
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

function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
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

function Panel({ title, variant, children }: PanelProps) {
  const bgClass = variant === "staff" ? "bg-zinc-900" : "bg-zinc-900/70";

  return (
    <div className={`flex-1 ${bgClass} border border-zinc-800 rounded-2xl p-6 min-h-[400px]`}>
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

interface StaffPanelProps {
  queueData: QueueData;
  onRefresh: () => void;
  onCustomerSelect: (token: string) => void;
  selectedCustomerToken: string | null;
}

function StaffPanel({
  queueData,
  onRefresh,
  onCustomerSelect,
  selectedCustomerToken,
}: StaffPanelProps) {
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const waitingCustomers = queueData.customers.filter((c) => c.status === "Waiting");
  const calledCustomers = queueData.customers.filter((c) => c.status === "Called");

  const handleCallNext = useCallback(async () => {
    setIsCallingNext(true);
    try {
      const response = await fetch(`${API_BASE}/api/queues/${queueData.queueId}/call-next`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to call next customer");
        console.error(errorMessage);
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to call next:", err);
    } finally {
      setIsCallingNext(false);
    }
  }, [queueData.queueId, onRefresh]);

  const handleSeedCustomers = useCallback(async () => {
    setIsSeeding(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/seed?queueId=${queueData.queueId}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to seed customers");
        console.error(errorMessage);
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to seed:", err);
    } finally {
      setIsSeeding(false);
    }
  }, [queueData.queueId, onRefresh]);

  const handleMarkServed = useCallback(
    async (customerId: string) => {
      setActionInProgress(customerId);
      try {
        const response = await fetch(
          `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}/serve`,
          { method: "POST" }
        );
        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as served");
          console.error(errorMessage);
        }
        onRefresh();
      } catch (err) {
        console.error("Failed to mark served:", err);
      } finally {
        setActionInProgress(null);
      }
    },
    [queueData.queueId, onRefresh]
  );

  const handleMarkNoShow = useCallback(
    async (customerId: string) => {
      setActionInProgress(customerId);
      try {
        const response = await fetch(
          `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}/no-show`,
          { method: "POST" }
        );
        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as no-show");
          console.error(errorMessage);
        }
        onRefresh();
      } catch (err) {
        console.error("Failed to mark no-show:", err);
      } finally {
        setActionInProgress(null);
      }
    },
    [queueData.queueId, onRefresh]
  );

  const handleRemoveCustomer = useCallback(
    async (customerId: string) => {
      setActionInProgress(customerId);
      try {
        const response = await fetch(
          `${API_BASE}/api/queues/${queueData.queueId}/customers/${customerId}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to remove customer");
          console.error(errorMessage);
        }
        onRefresh();
      } catch (err) {
        console.error("Failed to remove customer:", err);
      } finally {
        setActionInProgress(null);
      }
    },
    [queueData.queueId, onRefresh]
  );

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex gap-3">
        <button
          onClick={handleCallNext}
          disabled={waitingCustomers.length === 0 || isCallingNext}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isCallingNext ? "Calling..." : "Call Next"}
        </button>
        <button
          onClick={handleSeedCustomers}
          disabled={isSeeding}
          className="px-4 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSeeding ? "Adding..." : "+ Add Demo Customers"}
        </button>
        <button
          onClick={handleSeedCustomers}
          disabled={isSeeding}
          className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
          title="Reset demo to initial state"
        >
          ↺ Reset
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Waiting:</span>
          <span className="text-white font-semibold">{queueData.waitingCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Called:</span>
          <span className="text-amber-400 font-semibold">{queueData.calledCount}</span>
        </div>
      </div>

      {/* Called customers section */}
      {calledCustomers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-amber-400 uppercase tracking-wide">Called</h3>
          <div className="space-y-2">
            {calledCustomers.map((customer) => {
              const isSelected = customer.token === selectedCustomerToken;
              const isProcessing = actionInProgress === customer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() => onCustomerSelect(customer.token)}
                  className={`bg-amber-500/10 border rounded-xl p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-violet-500 ring-2 ring-violet-500/20"
                      : "border-amber-500/20 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      </div>
                      <span className="font-medium text-white">{customer.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkServed(customer.id);
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                      >
                        {isProcessing ? "..." : "Served"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkNoShow(customer.id);
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      >
                        {isProcessing ? "..." : "No-show"}
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <p className="text-xs text-violet-400 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Viewing this customer's perspective
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Waiting customers section */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Waiting</h3>
        {waitingCustomers.length === 0 ? (
          <div className="text-center py-8 text-zinc-600">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm">No customers waiting</p>
            <p className="text-xs mt-1">Click "+ Add Demo Customers" to populate the queue</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitingCustomers.map((customer) => {
              const isSelected = customer.token === selectedCustomerToken;
              const isProcessing = actionInProgress === customer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() => onCustomerSelect(customer.token)}
                  className={`bg-zinc-800 border rounded-xl p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-violet-500 ring-2 ring-violet-500/20"
                      : "border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center font-bold text-sm text-white">
                        {customer.position}
                      </div>
                      <span className="font-medium text-white">{customer.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomer(customer.id);
                      }}
                      disabled={isProcessing}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {isSelected && (
                    <p className="text-xs text-violet-400 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Viewing this customer's perspective
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomersResponse {
  customers: Customer[];
  queueInfo: {
    name: string;
    isActive: boolean;
    isPaused: boolean;
    waitingCount: number;
    calledCount: number;
  };
}

interface CustomerPositionData {
  position: number | null;
  status: string;
  queueName: string;
  businessName: string;
  calledMessage?: string;
  welcomeMessage?: string;
}

interface PositionChangedPayload {
  position: number;
  status: string;
}

interface CustomerPanelProps {
  token: string | null;
  signalR: {
    state: ConnectionState;
    invoke: <T = void>(methodName: string, ...args: unknown[]) => Promise<T>;
    on: <T = unknown>(eventName: string, callback: (data: T) => void) => () => void;
  };
}

function CustomerPanel({ token, signalR }: CustomerPanelProps) {
  const [data, setData] = useState<CustomerPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousTokenRef = useRef<string | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!token) {
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/q/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Customer not found");
        }
        throw new Error("Failed to fetch position");
      }

      const positionData = await safeJsonParse<CustomerPositionData>(response);
      if (!positionData) {
        throw new Error("Invalid position data");
      }

      setData(positionData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  // SignalR room management and event listeners
  useEffect(() => {
    if (!token || signalR.state !== "connected") {
      return;
    }

    const previousToken = previousTokenRef.current;

    // Leave previous room if token changed
    if (previousToken && previousToken !== token) {
      signalR.invoke("LeaveCustomerRoom", previousToken).catch((err) => {
        console.error("Failed to leave customer room:", err);
      });
    }

    // Join new room
    signalR.invoke("JoinCustomerRoom", token).catch((err) => {
      console.error("Failed to join customer room:", err);
    });

    previousTokenRef.current = token;

    // Set up event listeners
    function handlePositionChanged(payload: PositionChangedPayload): void {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          position: payload.position,
          status: payload.status,
        };
      });
    }

    function handleCalled(): void {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          status: "Called",
          position: null,
        };
      });
    }

    const unsubscribePositionChanged = signalR.on<PositionChangedPayload>("PositionChanged", handlePositionChanged);
    const unsubscribeCalled = signalR.on("Called", handleCalled);

    // Cleanup: leave room and remove listeners
    return () => {
      unsubscribePositionChanged();
      unsubscribeCalled();

      if (token) {
        signalR.invoke("LeaveCustomerRoom", token).catch((err) => {
          console.error("Failed to leave customer room on cleanup:", err);
        });
      }
    };
  }, [token, signalR]);

  // No token selected - show placeholder
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-500">
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
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        <p className="text-sm font-medium">Select a customer from the staff panel</p>
        <p className="text-xs text-zinc-600 mt-1">to see their live view</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-zinc-500 mt-4">Loading customer view...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-zinc-400">{error}</p>
        <button
          onClick={fetchPosition}
          className="mt-4 px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const isCalled = data.status === "Called";
  const isWaiting = data.status === "Waiting";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <p className="text-zinc-500 text-sm">{data.businessName}</p>
        <p className="text-zinc-400 text-xs">{data.queueName}</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center">
        {isCalled ? (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-20 blur-3xl" />
            <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">It's Your Turn!</h2>
              <p className="text-emerald-200/80">{data.calledMessage || "Please proceed to the counter"}</p>
            </div>
          </div>
        ) : isWaiting && data.position ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 text-center">
            <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">Your position</p>
            <div className="relative inline-block">
              <div className="text-8xl font-bold leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
                {data.position}
              </div>
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 blur-3xl -z-10" />
            </div>
            <p className="text-zinc-400 mt-3 text-sm">
              {data.position === 1 ? "You're next!" : `${data.position - 1} ${data.position - 1 === 1 ? "person" : "people"} ahead`}
            </p>
          </div>
        ) : (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 text-center">
            <p className="text-zinc-400">Status: {data.status}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <ConnectionIndicator state={signalR.state} />
      </div>
    </div>
  );
}

export function DemoPage() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [businessName, setBusinessName] = useState<string>("");
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [selectedCustomerToken, setSelectedCustomerToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signalR = useSignalR({ hubUrl: SIGNALR_HUB_URL });

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const primaryQueueId = queues[0]?.queueId;

  const fetchQueueData = useCallback(async () => {
    if (!primaryQueueId) return;

    try {
      const response = await fetch(`${API_BASE}/api/queues/${primaryQueueId}/customers`);
      if (!response.ok) {
        throw new Error("Failed to fetch queue customers");
      }

      const data = await safeJsonParse<CustomersResponse>(response);
      if (!data) {
        throw new Error("Invalid customers data");
      }

      setQueueData({
        queueId: primaryQueueId,
        queueName: data.queueInfo.name,
        customers: data.customers,
        waitingCount: data.queueInfo.waitingCount,
        calledCount: data.queueInfo.calledCount,
      });
    } catch (err) {
      console.error("Failed to fetch queue data:", err);
    }
  }, [primaryQueueId]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  useEffect(() => {
    if (primaryQueueId) {
      fetchQueueData();
    }
  }, [primaryQueueId, fetchQueueData]);

  // Staff room SignalR: join room and listen for QueueUpdated
  useEffect(() => {
    if (signalR.state !== "connected" || !queueData) {
      return;
    }

    const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

    signalR.invoke("JoinStaffRoom", DEMO_BUSINESS_ID).catch((err) => {
      console.error("Failed to join staff room:", err);
    });

    function handleQueueUpdated(): void {
      fetchQueueData();
    }

    const unsubscribe = signalR.on("QueueUpdated", handleQueueUpdated);

    return () => {
      unsubscribe();
      signalR.invoke("LeaveStaffRoom", DEMO_BUSINESS_ID).catch((err) => {
        console.error("Failed to leave staff room:", err);
      });
    };
  }, [signalR.state, queueData, signalR, fetchQueueData]);

  const handleCustomerSelect = useCallback((token: string) => {
    setSelectedCustomerToken((current) => (current === token ? null : token));
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchQueues} />;
  }

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
          <ConnectionIndicator state={signalR.state} />
        </div>
      </header>

      {/* Instructional banner */}
      <div className="bg-violet-500/10 border-b border-violet-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto text-center text-sm text-violet-300">
          <span className="font-medium">Try it:</span> Click "Call Next" on the left, watch the customer position update on the right in real-time!
        </div>
      </div>

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
            {queueData ? (
              <StaffPanel
                queueData={queueData}
                onRefresh={fetchQueueData}
                onCustomerSelect={handleCustomerSelect}
                selectedCustomerToken={selectedCustomerToken}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                <p className="text-sm mt-4">Loading queue data...</p>
              </div>
            )}
          </Panel>

          {/* Customer Panel */}
          <Panel title="Customer View" variant="customer">
            <CustomerPanel token={selectedCustomerToken} signalR={signalR} />
          </Panel>
        </div>
      </main>
    </div>
  );
}
