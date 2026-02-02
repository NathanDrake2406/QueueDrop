import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignalR } from "./useSignalR";

// Mock SignalR module - define mock functions inside factory to avoid hoisting issues
let mockConnectionState = 0; // HubConnectionState.Disconnected

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockInvoke = vi.fn();
const mockWithUrl = vi.fn();
const mockWithAutomaticReconnect = vi.fn();
const mockConfigureLogging = vi.fn();

vi.mock("@microsoft/signalr", async () => {
  return {
    HubConnectionBuilder: class {
      withUrl(...args: unknown[]) {
        mockWithUrl(...args);
        return this;
      }
      withAutomaticReconnect(...args: unknown[]) {
        mockWithAutomaticReconnect(...args);
        return this;
      }
      configureLogging(...args: unknown[]) {
        mockConfigureLogging(...args);
        return this;
      }
      build() {
        return {
          start: mockStart,
          stop: mockStop,
          on: mockOn,
          off: mockOff,
          invoke: mockInvoke,
          onreconnecting: vi.fn(),
          onreconnected: vi.fn(),
          onclose: vi.fn(),
          get state() {
            return mockConnectionState;
          },
        };
      }
    },
    HubConnectionState: {
      Disconnected: 0,
      Connecting: 1,
      Connected: 2,
      Reconnecting: 3,
    },
    LogLevel: {
      Warning: 2,
    },
  };
});

describe("useSignalR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockConnectionState = 0; // Disconnected
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should return disconnected state when autoConnect=false", () => {
      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      expect(result.current.state).toBe("disconnected");
    });
  });

  describe("connection lifecycle", () => {
    it("should call onStateChange with connecting when connect() called", async () => {
      const onStateChange = vi.fn();

      const { result } = renderHook(() =>
        useSignalR({
          hubUrl: "/hubs/queue",
          autoConnect: false,
          onStateChange,
        })
      );

      // Connect
      await act(async () => {
        mockConnectionState = 2;
        await result.current.connect();
      });

      // State should have been connecting at some point
      expect(onStateChange).toHaveBeenCalledWith("connecting");
    });

    it("should build connection with correct URL when connect() called", async () => {
      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      await act(async () => {
        mockConnectionState = 2;
        await result.current.connect();
      });

      expect(mockWithUrl).toHaveBeenCalledWith("/hubs/queue");
    });

    it("should handle connection errors gracefully", async () => {
      mockStart.mockRejectedValueOnce(new Error("Connection failed"));

      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      await act(async () => {
        try {
          await result.current.connect();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.state).toBe("disconnected");
    });

    it("should disconnect properly", async () => {
      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      // First connect
      await act(async () => {
        mockConnectionState = 2;
        await result.current.connect();
      });

      // Then disconnect
      await act(async () => {
        mockConnectionState = 0;
        await result.current.disconnect();
      });

      expect(mockStop).toHaveBeenCalled();
      expect(result.current.state).toBe("disconnected");
    });
  });

  describe("auto-connect behavior", () => {
    it("should auto-connect when autoConnect=true", async () => {
      // Use real timers for this test since async import + fake timers interact poorly
      vi.useRealTimers();

      const onStateChange = vi.fn();

      renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: true, onStateChange })
      );

      // Wait for the auto-connect timeout (100ms) + async import
      await act(async () => {
        mockConnectionState = 2;
        await new Promise((resolve) => setTimeout(resolve, 250));
      });

      // Verify auto-connect was triggered by checking state change to "connecting"
      expect(onStateChange).toHaveBeenCalledWith("connecting");
      expect(mockWithUrl).toHaveBeenCalledWith("/hubs/queue");

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe("hub methods", () => {
    it("should invoke hub methods when connected", async () => {
      mockInvoke.mockResolvedValueOnce({ result: "success" });

      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      // Connect first
      await act(async () => {
        mockConnectionState = 2;
        await result.current.connect();
      });

      // Then invoke
      await act(async () => {
        const response = await result.current.invoke("JoinGroup", "group-1");
        expect(response).toEqual({ result: "success" });
      });

      expect(mockInvoke).toHaveBeenCalledWith("JoinGroup", "group-1");
    });

    it("should register and unregister event handlers", async () => {
      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      // Connect first
      await act(async () => {
        mockConnectionState = 2;
        await result.current.connect();
      });

      const callback = vi.fn();
      let unsubscribe: () => void;

      act(() => {
        unsubscribe = result.current.on("PositionChanged", callback);
      });

      expect(mockOn).toHaveBeenCalledWith("PositionChanged", callback);

      act(() => {
        unsubscribe();
      });

      expect(mockOff).toHaveBeenCalledWith("PositionChanged", callback);
    });

    it("should reject invoke when not connected", async () => {
      const { result } = renderHook(() =>
        useSignalR({ hubUrl: "/hubs/queue", autoConnect: false })
      );

      // Try to invoke without connecting
      await act(async () => {
        await expect(result.current.invoke("JoinGroup", "group-1")).rejects.toThrow(
          "SignalR not connected"
        );
      });
    });
  });
});
