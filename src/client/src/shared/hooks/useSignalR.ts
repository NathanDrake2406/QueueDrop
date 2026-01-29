import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

interface UseSignalROptions {
  /** URL of the SignalR hub */
  hubUrl: string;
  /** Whether to automatically connect on mount */
  autoConnect?: boolean;
  /** Callback when connection state changes */
  onStateChange?: (state: ConnectionState) => void;
}

interface UseSignalRResult {
  /** Current connection state */
  state: ConnectionState;
  /** Invoke a hub method */
  invoke: <T = void>(methodName: string, ...args: unknown[]) => Promise<T>;
  /** Subscribe to a hub event */
  on: <T = unknown>(eventName: string, callback: (data: T) => void) => () => void;
  /** Manually connect */
  connect: () => Promise<void>;
  /** Manually disconnect */
  disconnect: () => Promise<void>;
}

/**
 * Hook for managing SignalR connection lifecycle.
 * Handles auto-reconnect with exponential backoff.
 */
export function useSignalR({ hubUrl, autoConnect = true, onStateChange }: UseSignalROptions): UseSignalRResult {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const connectionRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);

  // Update state helper
  const updateState = useCallback(
    (newState: ConnectionState) => {
      if (mountedRef.current) {
        setState(newState);
        onStateChange?.(newState);
      }
    },
    [onStateChange],
  );

  // Create connection
  useEffect(() => {
    // Reset mounted flag on each mount (important for StrictMode)
    mountedRef.current = true;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
          return delay;
        },
      })
      .configureLogging(LogLevel.Warning)
      .build();

    // Set up event handlers
    connection.onreconnecting(() => updateState("reconnecting"));
    connection.onreconnected(() => updateState("connected"));
    connection.onclose(() => {
      // Only update state if still mounted (avoids state update during cleanup)
      if (mountedRef.current) {
        updateState("disconnected");
      }
    });

    connectionRef.current = connection;

    return () => {
      mountedRef.current = false;
      // Stop connection without waiting - let it clean up in background
      connection.stop().catch(() => {
        // Ignore errors during cleanup
      });
    };
  }, [hubUrl, updateState]);

  // Start connection helper
  const startConnection = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Disconnected) return;
    if (!mountedRef.current) return; // Don't connect if unmounted

    updateState("connecting");
    try {
      await connection.start();
      // Only update state if still mounted
      if (mountedRef.current) {
        updateState("connected");
      }
    } catch (err) {
      // Ignore abort errors from StrictMode cleanup
      if (err instanceof Error && err.message.includes("stopped")) {
        return;
      }
      console.error("SignalR connection failed:", err);
      if (mountedRef.current) {
        updateState("disconnected");
      }
    }
  }, [updateState]);

  // Auto-connect (with small delay to handle StrictMode double-mount)
  useEffect(() => {
    if (!autoConnect) return;

    // Small delay allows StrictMode cleanup to complete before connecting
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        startConnection();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [autoConnect, startConnection]);

  // Invoke method
  const invoke = useCallback(async <T = void>(methodName: string, ...args: unknown[]): Promise<T> => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) {
      // Return rejected promise instead of throwing synchronously
      // This allows callers using .catch() to handle gracefully
      return Promise.reject(new Error("SignalR not connected"));
    }
    return connection.invoke<T>(methodName, ...args);
  }, []);

  // Subscribe to event
  const on = useCallback(<T = unknown>(eventName: string, callback: (data: T) => void): (() => void) => {
    const connection = connectionRef.current;
    if (!connection) {
      return () => {};
    }

    connection.on(eventName, callback);
    return () => connection.off(eventName, callback);
  }, []);

  // Manual connect
  const connect = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    if (connection.state === HubConnectionState.Disconnected) {
      updateState("connecting");
      try {
        await connection.start();
        updateState("connected");
      } catch (err) {
        console.error("SignalR connection failed:", err);
        updateState("disconnected");
        throw err;
      }
    }
  }, [updateState]);

  // Manual disconnect
  const disconnect = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.stop();
    updateState("disconnected");
  }, [updateState]);

  return { state, invoke, on, connect, disconnect };
}
