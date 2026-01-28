import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage, safeJsonParse } from "../../../shared/utils/api";

export interface QueueSettings {
  maxQueueSize: number | null;
  estimatedServiceTimeMinutes: number;
  noShowTimeoutMinutes: number;
  nearFrontThreshold: number | null;
  allowJoinWhenPaused: boolean;
  welcomeMessage: string | null;
  calledMessage: string | null;
}

interface UseQueueSettingsResult {
  /** Current settings data */
  settings: QueueSettings | null;
  /** Loading state */
  isLoading: boolean;
  /** Saving state */
  isSaving: boolean;
  /** Error message if any */
  error: string | null;
  /** Fetch settings from server */
  refresh: () => Promise<void>;
  /** Update settings on server */
  updateSettings: (newSettings: QueueSettings) => Promise<boolean>;
}

/**
 * Hook for managing queue settings.
 * Provides CRUD operations for queue configuration.
 */
export function useQueueSettings(queueId: string): UseQueueSettingsResult {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/queues/${queueId}/settings`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Queue not found.");
        }
        throw new Error("Failed to fetch settings");
      }

      const data = await safeJsonParse<QueueSettings>(response);
      if (!data) {
        throw new Error("Invalid response from server");
      }
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [queueId]);

  // Update settings on server
  const updateSettings = useCallback(
    async (newSettings: QueueSettings): Promise<boolean> => {
      try {
        setIsSaving(true);
        setError(null);

        const response = await fetch(`/api/queues/${queueId}/settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newSettings),
        });

        if (!response.ok) {
          if (response.status === 400) {
            const errorMessage = await getApiErrorMessage(response, "Invalid settings");
            throw new Error(errorMessage);
          }
          if (response.status === 409) {
            throw new Error("Settings were modified by someone else. Please refresh and try again.");
          }
          throw new Error("Failed to save settings");
        }

        // Update local state on success
        setSettings(newSettings);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [queueId],
  );

  // Initial fetch
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    refresh: fetchSettings,
    updateSettings,
  };
}
