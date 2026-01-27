import { useCallback, useEffect, useState } from "react";
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

  // Join staff room when connected
  useEffect(() => {
    if (connectionState === "connected" && queueId) {
      invoke("JoinStaffRoom", queueId).catch(console.error);
    }
  }, [connectionState, queueId, invoke]);

  // Listen for real-time updates
  useEffect(() => {
    const unsub = on<string>("QueueUpdated", () => {
      // Refetch when queue is updated
      fetchCustomers();
    });

    return () => unsub();
  }, [on, fetchCustomers]);

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

  // Mark customer as served
  const markServed = useCallback(
    async (customerId: string): Promise<boolean> => {
      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}/serve`, {
          method: "POST",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as served");
          throw new Error(errorMessage);
        }

        // Refresh immediately
        await fetchCustomers();
        return true;
      } catch (err) {
        console.error("markServed error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [queueId, fetchCustomers],
  );

  // Mark customer as no-show
  const markNoShow = useCallback(
    async (customerId: string): Promise<boolean> => {
      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}/no-show`, {
          method: "POST",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to mark as no-show");
          throw new Error(errorMessage);
        }

        // Refresh immediately
        await fetchCustomers();
        return true;
      } catch (err) {
        console.error("markNoShow error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [queueId, fetchCustomers],
  );

  // Remove customer from queue
  const removeCustomer = useCallback(
    async (customerId: string): Promise<boolean> => {
      try {
        setError(null);
        const response = await fetch(`/api/queues/${queueId}/customers/${customerId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorMessage = await getApiErrorMessage(response, "Failed to remove customer");
          throw new Error(errorMessage);
        }

        // Refresh immediately
        await fetchCustomers();
        return true;
      } catch (err) {
        console.error("removeCustomer error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [queueId, fetchCustomers],
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
