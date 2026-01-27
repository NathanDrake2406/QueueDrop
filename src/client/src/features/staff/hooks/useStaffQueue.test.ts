import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useStaffQueue } from "./useStaffQueue";

// Mock useSignalR
const mockInvoke = vi.fn();
const mockOn = vi.fn();

vi.mock("../../../shared/hooks/useSignalR", () => ({
  useSignalR: vi.fn(() => ({
    state: "connected",
    invoke: mockInvoke,
    on: mockOn,
  })),
}));

// Import useSignalR after mocking so we can control the mock
import { useSignalR } from "../../../shared/hooks/useSignalR";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useStaffQueue", () => {
  const mockQueueId = "queue-123";
  const mockCustomers = [
    {
      id: "c1",
      name: "Alice",
      token: "token-1",
      status: "Waiting",
      position: 1,
      joinedAt: "2024-01-01T10:00:00Z",
      calledAt: null,
      partySize: 2,
      notes: null,
    },
  ];
  const mockQueueInfo = {
    name: "Test Queue",
    isActive: true,
    isPaused: false,
    waitingCount: 1,
    calledCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    mockOn.mockReturnValue(() => {}); // Return unsubscribe function
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ customers: mockCustomers, queueInfo: mockQueueInfo }),
      text: () => Promise.resolve(JSON.stringify({ customers: mockCustomers, queueInfo: mockQueueInfo })),
    });

    // Reset useSignalR mock to default connected state
    (useSignalR as Mock).mockReturnValue({
      state: "connected",
      invoke: mockInvoke,
      on: mockOn,
    });
  });

  describe("SignalR room management", () => {
    it("should join staff room when connected", async () => {
      renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("JoinStaffRoom", mockQueueId);
      });
    });

    it("should not join staff room when disconnected", async () => {
      (useSignalR as Mock).mockReturnValue({
        state: "disconnected",
        invoke: mockInvoke,
        on: mockOn,
      });

      renderHook(() => useStaffQueue(mockQueueId));

      // Wait a tick to ensure effect has run
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(mockInvoke).not.toHaveBeenCalledWith("JoinStaffRoom", expect.anything());
    });

    it("should leave old room and join new room when queueId changes", async () => {
      const newQueueId = "queue-456";

      const { rerender } = renderHook(({ queueId }) => useStaffQueue(queueId), {
        initialProps: { queueId: mockQueueId },
      });

      // Wait for initial join
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("JoinStaffRoom", mockQueueId);
      });

      mockInvoke.mockClear();

      // Change queueId
      rerender({ queueId: newQueueId });

      // Should leave old room and join new room
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("LeaveStaffRoom", mockQueueId);
        expect(mockInvoke).toHaveBeenCalledWith("JoinStaffRoom", newQueueId);
      });
    });

    it("should leave room on unmount", async () => {
      const { unmount } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("JoinStaffRoom", mockQueueId);
      });

      mockInvoke.mockClear();

      unmount();

      expect(mockInvoke).toHaveBeenCalledWith("LeaveStaffRoom", mockQueueId);
    });
  });

  describe("QueueUpdated event filtering", () => {
    it("should subscribe to QueueUpdated events", async () => {
      renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(mockOn).toHaveBeenCalledWith("QueueUpdated", expect.any(Function));
      });
    });

    it("should only refetch when QueueUpdated matches current queueId", async () => {
      // Capture the QueueUpdated handler
      let queueUpdatedHandler: (queueId: string, updateType: string) => void = () => {};
      mockOn.mockImplementation((event, handler) => {
        if (event === "QueueUpdated") {
          queueUpdatedHandler = handler;
        }
        return () => {};
      });

      renderHook(() => useStaffQueue(mockQueueId));

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${mockQueueId}/customers`);
      });

      mockFetch.mockClear();

      // Trigger QueueUpdated for a DIFFERENT queue
      await act(async () => {
        queueUpdatedHandler("different-queue-id", "CustomerJoined");
        // Wait for debounce
        await new Promise((r) => setTimeout(r, 200));
      });

      // Should NOT refetch because queueId doesn't match
      expect(mockFetch).not.toHaveBeenCalled();

      // Trigger QueueUpdated for the CURRENT queue
      await act(async () => {
        queueUpdatedHandler(mockQueueId, "CustomerJoined");
        // Wait for debounce
        await new Promise((r) => setTimeout(r, 200));
      });

      // Should refetch because queueId matches
      expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${mockQueueId}/customers`);
    });
  });

  describe("data fetching", () => {
    it("should fetch customers on mount", async () => {
      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${mockQueueId}/customers`);
      expect(result.current.customers).toEqual(mockCustomers);
      expect(result.current.queueInfo).toEqual(mockQueueInfo);
    });

    it("should refetch when queueId changes", async () => {
      const newQueueId = "queue-456";

      const { result, rerender } = renderHook(({ queueId }) => useStaffQueue(queueId), {
        initialProps: { queueId: mockQueueId },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockClear();

      rerender({ queueId: newQueueId });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${newQueueId}/customers`);
      });
    });

    it("should set error on fetch failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to fetch queue data");
    });

    it("should set specific error for 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Queue not found.");
    });
  });

  describe("customer actions", () => {
    it("should call next customer", async () => {
      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockResolvedValue({ ok: true });

      await act(async () => {
        const success = await result.current.callNext();
        expect(success).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${mockQueueId}/call-next`, {
        method: "POST",
      });
    });

    it("should mark customer as served with optimistic update", async () => {
      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockResolvedValue({ ok: true });

      await act(async () => {
        const success = await result.current.markServed("c1");
        expect(success).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(`/api/queues/${mockQueueId}/customers/c1/serve`, {
        method: "POST",
      });
    });

    it("should revert optimistic update on error", async () => {
      const { result } = renderHook(() => useStaffQueue(mockQueueId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.customers).toHaveLength(1);
      });

      // Make the serve request fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      });

      // Then succeed on refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: mockCustomers, queueInfo: mockQueueInfo }),
        text: () => Promise.resolve(JSON.stringify({ customers: mockCustomers, queueInfo: mockQueueInfo })),
      });

      await act(async () => {
        const success = await result.current.markServed("c1");
        expect(success).toBe(false);
      });

      // Customer should be back after revert
      expect(result.current.customers).toHaveLength(1);
    });
  });
});
