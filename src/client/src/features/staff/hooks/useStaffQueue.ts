import { useCallback, useEffect, useRef, useState } from "react";
import { useSignalR } from "../../../shared/hooks/useSignalR";
import { getApiErrorMessage, safeJsonParse } from "../../../shared/utils/api";

export interface Customer {
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

export interface QueueInfo {
  name: string;
  isActive: boolean;
  isPaused: boolean;
  waitingCount: number;
  calledCount: number;
}

interface UseStaffQueueResult {
  /** Customers in the queue */
  customers: Customer[];
  /** Queue metadata */
  queueInfo: QueueInfo | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** SignalR connection state */
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
  /** Refresh data from server */
  refresh: () => Promise<void>;
  /** Call the next waiting customer */
  callNext: () => Promise<boolean>;
  /** Mark a customer as served */
  markServed: (customerId: string) => Promise<boolean>;
  /** Mark a customer as no-show */
  markNoShow: (customerId: string) => Promise<boolean>;
  /** Remove a customer from the queue */
  removeCustomer: (customerId: string) => Promise<boolean>;
}

/**
 * Hook for managing staff queue operations with real-time updates.
 */
export function useStaffQueue(queueId: string): UseStaffQueueResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
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

  // Fetch customers from API
  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch(`/api/queues/${queueId}/customers`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Queue not found.");
        }
        throw new Error("Failed to fetch queue data");
      }
      const data = await safeJsonParse<{ customers: Customer[]; queueInfo: QueueInfo }>(response);
      if (!data) {
        throw new Error("Invalid response from server");
      }
      setCustomers(data.customers);
      setQueueInfo(data.queueInfo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [queueId]);

  // Initial fetch
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Track the current room we've joined for cleanup
  const joinedRoomRef = useRef<string | null>(null);

  // Join staff room when connected, leave when queueId changes or unmount
  useEffect(() => {
    if (connectionState === "connected" && queueId) {
      // Leave previous room if we were in one
      if (joinedRoomRef.current && joinedRoomRef.current !== queueId) {
        invoke("LeaveStaffRoom", joinedRoomRef.current).catch(console.error);
      }
      // Join new room
      invoke("JoinStaffRoom", queueId).catch(console.error);
      joinedRoomRef.current = queueId;
    }

    // Cleanup: leave room on unmount or when dependencies change
    return () => {
      if (joinedRoomRef.current) {
        invoke("LeaveStaffRoom", joinedRoomRef.current).catch(console.error);
        joinedRoomRef.current = null;
      }
    };
  }, [connectionState, queueId, invoke]);

  // Listen for real-time updates with debouncing to prevent rapid re-renders
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Handler receives (queueId, updateType) from SignalR
    const unsub = on<string>("QueueUpdated", (eventQueueId: string) => {
      // Only process updates for the current queue
      if (eventQueueId !== queueId) {
        return;
      }

      // Debounce rapid updates (e.g., multiple customers joining at once)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        fetchCustomers();
      }, 150); // 150ms debounce
    });

    return () => {
      unsub();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [on, fetchCustomers, queueId]);

  // Call next waiting customer
  const callNext = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`/api/queues/${queueId}/call-next`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to call next customer");
        throw new Error(errorMessage);
      }

      // Refresh immediately (don't wait for SignalR in case it's disconnected)
      await fetchCustomers();
      return true;
    } catch (err) {
      console.error("callNext error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  }, [queueId, fetchCustomers]);

  // Optimistic update helper - removes customer from local state immediately
  const optimisticRemove = useCallback((customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setQueueInfo((prev) => (prev ? { ...prev, waitingCount: Math.max(0, prev.waitingCount - 1) } : prev));
  }, []);

  // Mark customer as served
  const markServed = useCallback(
    async (customerId: string): Promise<boolean> => {
      // Optimistic update - remove from UI immediately
      optimisticRemove(customerId);

      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}/serve`, {
          method: "POST",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as served");
          throw new Error(errorMessage);
        }

        return true;
      } catch (err) {
        console.error("markServed error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        // Revert on error
        await fetchCustomers();
        return false;
      }
    },
    [queueId, fetchCustomers, optimisticRemove],
  );

  // Mark customer as no-show
  const markNoShow = useCallback(
    async (customerId: string): Promise<boolean> => {
      // Optimistic update - remove from UI immediately
      optimisticRemove(customerId);

      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}/no-show`, {
          method: "POST",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as no-show");
          throw new Error(errorMessage);
        }

        return true;
      } catch (err) {
        console.error("markNoShow error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        // Revert on error
        await fetchCustomers();
        return false;
      }
    },
    [queueId, fetchCustomers, optimisticRemove],
  );

  // Remove customer from queue
  const removeCustomer = useCallback(
    async (customerId: string): Promise<boolean> => {
      // Optimistic update - remove from UI immediately
      optimisticRemove(customerId);

      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to remove customer");
          throw new Error(errorMessage);
        }

        return true;
      } catch (err) {
        console.error("removeCustomer error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        // Revert on error
        await fetchCustomers();
        return false;
      }
    },
    [queueId, fetchCustomers, optimisticRemove],
  );

  return {
    customers,
    queueInfo,
    isLoading,
    error,
    connectionState,
    refresh: fetchCustomers,
    callNext,
    markServed,
    markNoShow,
    removeCustomer,
  };
}
