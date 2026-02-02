import type { HubConnection } from "@microsoft/signalr";
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

// Lazy-loaded SignalR module
let signalRModule: typeof import("@microsoft/signalr") | null = null;

async function getSignalR() {
  if (!signalRModule) {
    signalRModule = await import("@microsoft/signalr");
  }
  return signalRModule;
}

/**
 * Hook for managing SignalR connection lifecycle.
 * Handles auto-reconnect with exponential backoff.
 * SignalR module is lazy-loaded only when a connection is needed.
 */
export function useSignalR({ hubUrl, autoConnect = true, onStateChange }: UseSignalROptions): UseSignalRResult {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const connectionRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);
  const hubUrlRef = useRef(hubUrl);

  // Keep hubUrl ref updated (in effect to satisfy lint rules)
  useEffect(() => {
    hubUrlRef.current = hubUrl;
  }, [hubUrl]);

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

  // Create connection (lazy - only imports SignalR when called)
  const ensureConnection = useCallback(async (): Promise<HubConnection> => {
    if (connectionRef.current) {
      return connectionRef.current;
    }

    // Dynamic import - SignalR is only loaded when we actually need to connect
    const { HubConnectionBuilder, LogLevel } = await getSignalR();

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrlRef.current)
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
      if (mountedRef.current) {
        updateState("disconnected");
      }
    });

    connectionRef.current = connection;
    return connection;
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (connectionRef.current) {
        connectionRef.current.stop().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, []);

  // Start connection helper
  const startConnection = useCallback(async () => {
    if (!mountedRef.current) return;

    updateState("connecting");
    try {
      const connection = await ensureConnection();
      const { HubConnectionState } = await getSignalR();

      if (connection.state !== HubConnectionState.Disconnected) return;

      await connection.start();
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
  }, [ensureConnection, updateState]);

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
    if (!connection) {
      return Promise.reject(new Error("SignalR not connected"));
    }

    const { HubConnectionState } = await getSignalR();
    if (connection.state !== HubConnectionState.Connected) {
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
    updateState("connecting");
    try {
      const connection = await ensureConnection();
      const { HubConnectionState } = await getSignalR();

      if (connection.state === HubConnectionState.Disconnected) {
        await connection.start();
        updateState("connected");
      }
    } catch (err) {
      console.error("SignalR connection failed:", err);
      updateState("disconnected");
      throw err;
    }
  }, [ensureConnection, updateState]);

  // Manual disconnect
  const disconnect = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection) return;

    await connection.stop();
    updateState("disconnected");
  }, [updateState]);

  return { state, invoke, on, connect, disconnect };
}
