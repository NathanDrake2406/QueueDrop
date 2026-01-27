import { useState, useCallback, useEffect } from "react";
import { safeJsonParse } from "../../../shared/utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UsePushNotificationsResult extends PushNotificationState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

/**
 * Hook for managing Web Push notification subscriptions.
 * Handles permission requests, service worker registration, and backend subscription storage.
 */
export function usePushNotifications(customerToken: string | null): UsePushNotificationsResult {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: false,
    error: null,
  });

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!subscription }));
    } catch {
      // Silently ignore - not critical
    }
  }, []);

  // Check browser support and current permission on mount
  useEffect(() => {
    const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: true,
        permission: Notification.permission,
      }));

      // Check if already subscribed
      checkExistingSubscription();
    }
  }, [checkExistingSubscription]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!customerToken) {
      setState((prev) => ({ ...prev, error: "No customer token" }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Permission denied",
        }));
        return false;
      }

      // Get VAPID public key from server
      const vapidResponse = await fetch(`${API_BASE}/api/push/vapid-public-key`);
      if (!vapidResponse.ok) {
        throw new Error("Failed to get VAPID public key");
      }
      const vapidData = await safeJsonParse<{ publicKey: string }>(vapidResponse);
      if (!vapidData?.publicKey) {
        throw new Error("Invalid VAPID key response");
      }
      const { publicKey } = vapidData;

      // Wait for service worker
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract subscription details
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscriptionJson.endpoint!;
      const p256dh = subscriptionJson.keys!.p256dh;
      const auth = subscriptionJson.keys!.auth;

      // Save subscription to backend
      const saveResponse = await fetch(`${API_BASE}/api/q/${customerToken}/push-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, p256dh, auth }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save subscription");
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isSubscribed: true,
      }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to subscribe";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return false;
    }
  }, [customerToken]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      setState((prev) => ({ ...prev, isSubscribed: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unsubscribe";
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

/**
 * Converts a base64-encoded VAPID public key to a Uint8Array.
 * Required format for PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
