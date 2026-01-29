import { useState, useEffect } from "react";
import { useQueueSettings } from "./hooks/useQueueSettings";
import type { QueueSettings as QueueSettingsType } from "./hooks/useQueueSettings";

interface QueueSettingsProps {
  queueId: string;
  onClose?: () => void;
}

export function QueueSettings({ queueId, onClose }: QueueSettingsProps) {
  const { settings, isLoading, isSaving, error, updateSettings } = useQueueSettings(queueId);

  // Local form state
  const [formData, setFormData] = useState<QueueSettingsType | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSuccessMessage(null);
    const success = await updateSettings(formData);
    if (success) {
      setSuccessMessage("Settings saved!");
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleChange = (field: keyof QueueSettingsType, value: string | number | boolean | null) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!formData) {
    return <div className="p-4 text-red-400">Failed to load settings</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Max Queue Size */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Max queue size</label>
          <input
            type="number"
            min="1"
            value={formData.maxQueueSize ?? ""}
            onChange={(e) => handleChange("maxQueueSize", e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="Unlimited"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />
          <p className="mt-1 text-xs text-slate-600">Leave empty for no limit</p>
        </div>

        {/* No-Show Timeout */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">No-show timeout (minutes)</label>
          <input
            type="number"
            min="1"
            required
            value={formData.noShowTimeoutMinutes}
            onChange={(e) => handleChange("noShowTimeoutMinutes", parseInt(e.target.value, 10) || 1)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />
          <p className="mt-1 text-xs text-slate-600">Auto-mark called customers as no-show after this time</p>
        </div>

        {/* Near-Front Threshold */}
        <div>
          <label htmlFor="nearFrontThreshold" className="block text-sm font-medium text-slate-400 mb-2">
            Near-front alert position
          </label>
          <input
            type="number"
            id="nearFrontThreshold"
            value={formData.nearFrontThreshold ?? ""}
            onChange={(e) => handleChange("nearFrontThreshold", e.target.value ? parseInt(e.target.value, 10) : null)}
            min={1}
            max={10}
            placeholder="Disabled"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">Notify customers when they reach this position (1-10)</p>
        </div>

        {/* Allow Join When Paused */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl">
          <div>
            <p className="text-sm font-medium text-white">Allow joining when paused</p>
            <p className="text-xs text-slate-500 mt-0.5">Customers can join even when queue is paused</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange("allowJoinWhenPaused", !formData.allowJoinWhenPaused)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              formData.allowJoinWhenPaused ? "bg-teal-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.allowJoinWhenPaused ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Welcome message</label>
          <textarea
            value={formData.welcomeMessage ?? ""}
            onChange={(e) => handleChange("welcomeMessage", e.target.value || null)}
            placeholder="Shown when customers join..."
            rows={2}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
          />
        </div>

        {/* Called Message */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Called message</label>
          <textarea
            value={formData.calledMessage ?? ""}
            onChange={(e) => handleChange("calledMessage", e.target.value || null)}
            placeholder="Shown when it's their turn..."
            rows={2}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />}
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
