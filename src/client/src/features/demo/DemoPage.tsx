"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getApiErrorMessage, safeJsonParse } from "../../shared/utils/api";
import { useDarkMode } from "@/shared/hooks/useDarkMode";
import { useSignalR, type ConnectionState } from "../../shared/hooks/useSignalR";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
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

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border border-teal-500/30" />
        <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-transparent border-t-teal-400 animate-spin" />
      </div>
    </div>
  );
}

interface ErrorDisplayProps {
  message: string;
  onRetry: () => void;
}

function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center border border-red-500/30 bg-red-500/5 rounded-none px-6 py-8 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <div className="w-16 h-16 bg-red-500/20 rounded-none flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-slate-300/80 mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-center text-sm text-slate-500 mb-4">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span>Connection paused</span>
        </div>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-white text-slate-900 font-semibold rounded-none hover:bg-slate-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

interface PanelProps {
  isDark: boolean;
  title: string;
  variant: "staff" | "customer";
  children: React.ReactNode;
}

function Panel({ title, variant, children, isDark }: PanelProps) {
  const bgClass = isDark
    ? variant === "staff"
      ? "bg-slate-900"
      : "bg-slate-900/70"
    : variant === "staff"
      ? "bg-white"
      : "bg-slate-50";
  const borderClass = isDark ? "border-slate-800" : "border-slate-200";
  const accentClass = isDark
    ? variant === "staff"
      ? "shadow-[0_14px_40px_rgba(0,0,0,0.30)]"
      : "shadow-[0_10px_32px_rgba(0,0,0,0.25)]"
    : "shadow-[0_12px_30px_rgba(15,23,42,0.08)]";

  return (
    <div className={`flex-1 ${bgClass} border ${borderClass} rounded-none p-6 min-h-[420px] backdrop-blur-sm ${accentClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold font-display tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>{title}</h2>
        <div className={`h-px flex-1 ml-4 bg-gradient-to-r ${isDark ? "from-white/15 via-white/5" : "from-slate-900/10 via-slate-900/5"} to-transparent`} />
      </div>
      {children}
    </div>
  );
}

interface StaffPanelProps {
  isDark: boolean;
  queueData: QueueData;
  onRefresh: () => void;
  onCustomerSelect: (token: string | null) => void;
  selectedCustomerToken: string | null;
}

function StaffPanel({
  isDark,
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

  const [isResetting, setIsResetting] = useState(false);

  const handleSeedCustomers = useCallback(async () => {
    setIsSeeding(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/seed?queueId=${queueData.queueId}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to add customers");
        console.error(errorMessage);
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to add customers:", err);
    } finally {
      setIsSeeding(false);
    }
  }, [queueData.queueId, onRefresh]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/reset?queueId=${queueData.queueId}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to reset queue");
        console.error(errorMessage);
      }
      onRefresh();
      onCustomerSelect(null);
    } catch (err) {
      console.error("Failed to reset:", err);
    } finally {
      setIsResetting(false);
    }
  }, [queueData.queueId, onRefresh, onCustomerSelect]);

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
          className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
        >
          {isCallingNext ? "Calling..." : "Call Next"}
        </button>
        <button
          onClick={handleSeedCustomers}
          disabled={isSeeding}
          className={`px-4 py-3 font-medium rounded-none border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
            isDark
              ? "bg-slate-800 text-white border-white/5 hover:border-teal-400/40 hover:bg-slate-800/80"
              : "bg-slate-100 text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-white"
          }`}
        >
          {isSeeding ? "Adding..." : "+ Add Demo Customers"}
        </button>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className={`px-4 py-3 rounded-none border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
            isDark
              ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-red-400/40 hover:text-white"
              : "bg-white text-slate-700 border-slate-200 hover:border-red-300 hover:text-red-500"
          }`}
          title="Clear all customers from queue"
        >
          {isResetting ? "..." : "↺ Clear"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className={`flex items-center gap-3 rounded-none border px-3 py-2 ${
          isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-100 border-slate-200"
        }`}>
          <div className={`w-9 h-9 rounded-none flex items-center justify-center font-bold ${
            isDark ? "bg-slate-700 text-white" : "bg-white text-slate-900 border border-slate-200"
          }`}>{queueData.waitingCount}</div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Waiting</p>
            <p className={`${isDark ? "text-white" : "text-slate-900"} text-sm`}>Guests in line</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 rounded-none border px-3 py-2 ${
          isDark ? "bg-amber-500/10 border-amber-400/30" : "bg-amber-50 border-amber-200"
        }`}>
          <div className={`w-9 h-9 rounded-none flex items-center justify-center font-bold ${
            isDark ? "bg-amber-500/30 text-white" : "bg-amber-100 text-amber-700 border border-amber-200"
          }`}>{queueData.calledCount}</div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-amber-300/80">Called</p>
            <p className={`${isDark ? "text-amber-100" : "text-amber-800"} text-sm`}>Awaiting service</p>
          </div>
        </div>
      </div>

      {/* Called customers section */}
      {calledCustomers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-amber-200 uppercase tracking-[0.12em] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Called to counter
          </h3>
          <div className="space-y-2">
            {calledCustomers.map((customer) => {
              const isSelected = customer.token === selectedCustomerToken;
              const isProcessing = actionInProgress === customer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() => onCustomerSelect(customer.token)}
                  className={`border rounded-none p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-teal-400 ring-2 ring-teal-400/20 shadow-[0_12px_32px_rgba(20,184,166,0.25)]"
                      : isDark
                        ? "bg-amber-500/10 border-amber-500/20 hover:border-amber-400/40"
                        : "bg-amber-50 border-amber-200 hover:border-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-none flex items-center justify-center ${
                        isDark ? "bg-amber-500/25" : "bg-amber-100"
                      }`}>
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      </div>
                      <span className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{customer.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkServed(customer.id);
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-none hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                      >
                        {isProcessing ? "..." : "Served"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkNoShow(customer.id);
                        }}
                        disabled={isProcessing}
                        className={`px-3 py-1.5 text-sm font-medium rounded-none disabled:opacity-50 transition-colors ${
                          isDark ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        {isProcessing ? "..." : "No-show"}
                      </button>
                    </div>
                  </div>
                  {isSelected && (
                    <p className="text-xs text-teal-400 mt-2 flex items-center gap-1">
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
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Waiting</h3>
        {waitingCustomers.length === 0 ? (
        <div className={`text-center py-10 text-slate-500 border border-dashed rounded-none ${
          isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
        }`}>
          <div className="flex justify-center mb-4">
            <div className={`w-14 h-14 rounded-none flex items-center justify-center ${
              isDark ? "bg-gradient-to-br from-slate-700 to-slate-800" : "bg-gradient-to-br from-slate-200 to-white"
            }`}>
              <svg
                className="w-7 h-7 text-slate-300"
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
            </div>
          </div>
          <p className="text-sm font-medium text-slate-200">No customers waiting</p>
          <p className="text-xs mt-1 text-slate-500">Click "+ Add Demo Customers" to populate the queue</p>
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
                  className={`border rounded-none p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-teal-500 ring-2 ring-teal-500/20"
                      : isDark
                        ? "bg-slate-800 border-slate-700 hover:border-slate-600"
                        : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-none flex items-center justify-center font-bold text-sm ${
                        isDark ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-800"
                      }`}>
                        {customer.position}
                      </div>
                      <span className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{customer.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomer(customer.id);
                      }}
                      disabled={isProcessing}
                      className={`p-1.5 rounded-none disabled:opacity-50 transition-colors ${
                        isDark ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-500 hover:text-red-500 hover:bg-red-100"
                      }`}
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
                    <p className="text-xs text-teal-400 mt-2 flex items-center gap-1">
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
  isDark: boolean;
}

function CustomerPanel({ token, signalR, isDark }: CustomerPanelProps) {
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
      if (err instanceof Error && err.message === "SignalR not connected") {
        return; // avoid noisy console when connection is still warming up
      }
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

      // Only try to leave room if still connected (may already be disconnected during cleanup)
      if (token && signalR.state === "connected") {
        signalR.invoke("LeaveCustomerRoom", token).catch((err) => {
          if (err instanceof Error && err.message === "SignalR not connected") {
            return;
          }
          console.warn("Failed to leave customer room:", err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signalR methods are stable
  }, [token, signalR.state, signalR.invoke, signalR.on]);

  // No token selected - show placeholder
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"
        }`}>
          <svg
            className="w-5 h-5"
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
        </div>
        <p className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-slate-800"}`}>Select a customer from the staff panel</p>
        <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>to preview their live updates</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border border-slate-800" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-teal-400 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 mt-4">Loading customer view...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[320px] text-center rounded-none border ${
        isDark ? "border-red-500/30 bg-red-500/5" : "border-red-200 bg-red-50"
      }`}>
        <div className={`w-12 h-12 rounded-none flex items-center justify-center mb-4 ${
          isDark ? "bg-red-500/20" : "bg-red-100"
        }`}>
          <svg className="w-6 h-6 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-300">{error}</p>
        <button
          onClick={fetchPosition}
          className="mt-4 px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-none hover:bg-slate-100 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const isCalled = data.status === "Called";
  const isWaiting = data.status === "Waiting";

  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <div className="relative flex-1">
        <div className="sticky top-1/2 -translate-y-1/2 transform space-y-4">
          {isCalled ? (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.18),transparent_32%)] blur-3xl" />
              <div className={`relative border rounded-none p-7 text-center ${
                isDark
                  ? "bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-400/40 shadow-[0_14px_38px_rgba(16,185,129,0.24)]"
                  : "bg-white border-emerald-200 shadow-[0_14px_32px_rgba(16,185,129,0.15)]"
              }`}>
                <div className={`w-16 h-16 rounded-none flex items-center justify-center mx-auto mb-4 shadow-inner ${
                  isDark ? "bg-emerald-500/25 shadow-emerald-900/50" : "bg-emerald-100 shadow-emerald-200"
                }`}>
                  <svg
                    className="w-8 h-8 text-emerald-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 font-display">It's your turn</h2>
                <p className={`${isDark ? "text-emerald-50/80" : "text-emerald-800"} text-sm`}>
                  {data.calledMessage || "Please proceed to the counter"}
                </p>
              </div>
            </div>
          ) : isWaiting && data.position ? (
            <div className={`relative overflow-hidden rounded-none border p-7 text-center ${
              isDark
                ? "border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 shadow-[0_12px_34px_rgba(0,0,0,0.3)]"
                : "border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
            }`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_30%)] blur-3xl" />
              <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-3">Your position</p>
              <div className="relative inline-flex items-baseline justify-center">
                <div className="text-8xl font-bold leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent drop-shadow-[0_10px_35px_rgba(16,185,129,0.25)]">
                  {data.position}
                </div>
              </div>
              <p className="text-slate-300 mt-4 text-sm">
                {data.position === 1 ? "You're next!" : `${data.position - 1} ${data.position - 1 === 1 ? "person" : "people"} ahead of you`}
              </p>
              <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <p className={`text-[11px] uppercase tracking-[0.16em] mt-3 ${isDark ? "text-emerald-300/80" : "text-emerald-700"}`}>
                Live updates on deck
              </p>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-none p-6 text-center">
              <p className="text-slate-400">Status: {data.status}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export function DemoPage() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [businessName, setBusinessName] = useState<string>("");
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [selectedCustomerToken, setSelectedCustomerToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useDarkMode();

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
      // Auto-select first queue
      if (data.queues.length > 0 && !selectedQueueId) {
        setSelectedQueueId(data.queues[0].queueId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fetch on mount
  }, []);

  const fetchQueueData = useCallback(async () => {
    if (!selectedQueueId) return;

    try {
      const response = await fetch(`${API_BASE}/api/queues/${selectedQueueId}/customers`);
      if (!response.ok) {
        throw new Error("Failed to fetch queue customers");
      }

      const data = await safeJsonParse<CustomersResponse>(response);
      if (!data) {
        throw new Error("Invalid customers data");
      }

      setQueueData({
        queueId: selectedQueueId,
        queueName: data.queueInfo.name,
        customers: data.customers,
        waitingCount: data.queueInfo.waitingCount,
        calledCount: data.queueInfo.calledCount,
      });
    } catch (err) {
      console.error("Failed to fetch queue data:", err);
    }
  }, [selectedQueueId]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  useEffect(() => {
    if (selectedQueueId) {
      fetchQueueData();
    }
  }, [selectedQueueId, fetchQueueData]);

  // Clear selected customer if it no longer exists (e.g., after reset/remove)
  useEffect(() => {
    if (!selectedCustomerToken || !queueData) return;
    const stillPresent = queueData.customers.some((c) => c.token === selectedCustomerToken);
    if (!stillPresent) {
      setSelectedCustomerToken(null);
    }
  }, [queueData, selectedCustomerToken]);

  // Get the display count for a queue - use live data for selected queue
  const getQueueWaitingCount = useCallback((queueId: string): number => {
    if (queueId === selectedQueueId && queueData) {
      return queueData.waitingCount;
    }
    return queues.find(q => q.queueId === queueId)?.waitingCount ?? 0;
  }, [selectedQueueId, queueData, queues]);

  // Staff room SignalR: join room and listen for QueueUpdated
  useEffect(() => {
    if (signalR.state !== "connected" || !queueData) {
      return;
    }

    const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

    signalR.invoke("JoinStaffRoom", DEMO_BUSINESS_ID).catch((err) => {
      if (err instanceof Error && err.message === "SignalR not connected") {
        return;
      }
      console.error("Failed to join staff room:", err);
    });

    function handleQueueUpdated(): void {
      fetchQueueData();
    }

    const unsubscribe = signalR.on("QueueUpdated", handleQueueUpdated);

    return () => {
      unsubscribe();
      // Only try to leave room if still connected (may already be disconnected during cleanup)
      if (signalR.state === "connected") {
        signalR.invoke("LeaveStaffRoom", DEMO_BUSINESS_ID).catch((err) => {
          if (err instanceof Error && err.message === "SignalR not connected") {
            return;
          }
          console.warn("Failed to leave staff room:", err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signalR methods are stable
  }, [signalR.state, queueData, signalR.invoke, signalR.on, fetchQueueData]);

  const handleCustomerSelect = useCallback((token: string | null) => {
    if (token === null) {
      setSelectedCustomerToken(null);
      return;
    }
    setSelectedCustomerToken((current) => (current === token ? null : token));
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchQueues} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Header (kept minimal) */}
      <header className={`${isDark ? "border-b border-white/5 bg-slate-950/70" : "border-b border-slate-200 bg-white/80"} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`flex items-center gap-2 transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <div className="w-px h-6 bg-slate-800" />
            <h1 className="text-lg font-semibold font-display tracking-tight">Interactive Demo</h1>
            {businessName && (
              <span className="text-xs text-slate-500 px-2 py-1 rounded-none border border-white/10 bg-white/5">
                {businessName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDark(!isDark)}
              aria-label="Toggle dark mode"
              className={`p-2 rounded-none border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 focus-visible:ring-offset-slate-900"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:ring-offset-white"
              }`}
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <ConnectionIndicator state={signalR.state} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-10">

        {/* Queue Tabs */}
        {queues.length > 1 && (
          <div className="mb-8 flex gap-2 flex-wrap">
            {queues.map((queue) => (
              <button
                key={queue.queueId}
                onClick={() => {
                  setSelectedQueueId(queue.queueId);
                  setSelectedCustomerToken(null);
                }}
                className={`px-4 py-2 rounded-none font-medium text-sm transition-all border ${
                  selectedQueueId === queue.queueId
                    ? isDark
                      ? "bg-emerald-500/20 border-emerald-400/40 text-white shadow-[0_14px_30px_rgba(16,185,129,0.25)]"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-[0_8px_20px_rgba(16,185,129,0.15)]"
                    : isDark
                      ? "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-400/30 hover:text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                {queue.name}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs tabular-nums border ${
                  selectedQueueId === queue.queueId
                    ? isDark
                      ? "bg-emerald-500/25 text-emerald-50 border-transparent"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : isDark
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  {getQueueWaitingCount(queue.queueId)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Split layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Staff Panel */}
          <Panel title="Staff Dashboard" variant="staff" isDark={isDark}>
            {queueData ? (
              <StaffPanel
                isDark={isDark}
                queueData={queueData}
                onRefresh={fetchQueueData}
          onCustomerSelect={handleCustomerSelect}
                selectedCustomerToken={selectedCustomerToken}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
                <p className="text-sm mt-4">Loading queue data...</p>
              </div>
            )}
          </Panel>

          {/* Customer Panel */}
          <Panel title="Customer View" variant="customer" isDark={isDark}>
            <CustomerPanel token={selectedCustomerToken} signalR={signalR} isDark={isDark} />
          </Panel>
        </div>
      </main>
    </div>
  );
}
