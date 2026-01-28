import { useCallback, useEffect, useState } from "react";
import { useSignalR } from "../../../shared/hooks/useSignalR";
import { safeJsonParse } from "../../../shared/utils/api";

interface QueuePosition {
  position: number | null;
  status: string;
  queueName: string;
  businessName: string;
  estimatedWaitMinutes: number | null;
  recentActivity: number;
  welcomeMessage: string | null;
  calledMessage: string | null;
  nearFrontAlert: boolean;
}

interface UseQueuePositionResult {
  /** Current position data */
  data: QueuePosition | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** SignalR connection state */
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  /** Manually refresh position */
  refresh: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds fallback

/**
 * Hook for tracking customer queue position with real-time updates.
 * Uses SignalR for live updates, falls back to polling if disconnected.
 */
export function useQueuePosition(token: string): UseQueuePositionResult {
  const [data, setData] = useState<QueuePosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    state: connectionState,
    invoke,
    on,
  } = useSignalR({
    hubUrl: "/hubs/queue",
    autoConnect: true,
  });

  // Fetch position from API
  const fetchPosition = useCallback(async () => {
    try {
      const response = await fetch(`/api/q/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Customer not found. Your link may have expired.");
        }
        throw new Error("Failed to fetch queue position");
      }
      const result = await safeJsonParse<QueuePosition>(response);
      if (!result) {
        throw new Error("Invalid response from server");
      }
      setData({ ...result, nearFrontAlert: false });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  // Join customer room when connected
  useEffect(() => {
    if (connectionState === "connected" && token) {
      invoke("JoinCustomerRoom", token).catch(console.error);
    }
  }, [connectionState, token, invoke]);

  // Listen for real-time updates
  useEffect(() => {
    const unsubPosition = on<number>("PositionChanged", (newPosition) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              position: newPosition,
              // Recalculate estimated wait based on new position
              estimatedWaitMinutes:
                prev.estimatedWaitMinutes !== null
                  ? Math.max(0, (newPosition - 1) * 5) // Assume 5 min per customer
                  : null,
            }
          : null,
      );
    });

    const unsubCalled = on<string | null>("YouAreCalled", (message) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: "Called",
              position: null,
              calledMessage: message ?? prev.calledMessage,
            }
          : null,
      );
    });

    const unsubStatus = on<string>("StatusChanged", (status) => {
      setData((prev) => (prev ? { ...prev, status } : null));
    });

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

    return () => {
      unsubPosition();
      unsubCalled();
      unsubStatus();
      unsubNearFront();
    };
  }, [on]);

  // Fallback polling when disconnected
  useEffect(() => {
    if (connectionState === "disconnected") {
      const interval = setInterval(fetchPosition, POLLING_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [connectionState, fetchPosition]);

  return {
    data,
    isLoading,
    error,
    connectionState,
    refresh: fetchPosition,
  };
}
