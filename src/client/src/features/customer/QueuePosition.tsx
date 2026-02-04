import { useQueuePosition } from "./hooks/useQueuePosition";
import { usePushNotifications } from "./hooks/usePushNotifications";

function ConnectionIndicator({ state }: { state: "connecting" | "connected" | "reconnecting" | "disconnected" }) {
  const colors = {
    connected: "bg-emerald-400 animate-pulse",
    connecting: "bg-amber-400 animate-pulse",
    reconnecting: "bg-amber-400 animate-pulse",
    disconnected: "bg-red-500",
  };

  const labels = {
    connected: "Live updates active",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-white/5 border border-white/5 backdrop-blur">
      <div className={`w-2.5 h-2.5 rounded-full ${colors[state]} shadow-[0_0_0_4px_rgba(255,255,255,0.04)]`} />
      <span className="text-[11px] text-slate-200 uppercase tracking-[0.08em]">
        {labels[state]}
      </span>
    </div>
  );
}

function PositionDisplay({ position }: { position: number }) {
  return (
    <div className="relative overflow-hidden rounded-none border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-7 text-center shadow-[0_12px_34px_rgba(0,0,0,0.3)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_30%)] blur-3xl" />
      <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-3">Your position</p>
      <div className="relative inline-flex items-baseline justify-center">
        <div className="text-8xl font-bold leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent drop-shadow-[0_10px_35px_rgba(16,185,129,0.25)]">
          {position}
        </div>
      </div>
      <p className="text-slate-300 mt-4 text-sm">
        {position === 1 ? "You're next!" : `${position - 1} ${position - 1 === 1 ? "person" : "people"} ahead of you`}
      </p>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[11px] uppercase tracking-[0.16em] mt-3 text-emerald-300/80">
        Live updates on deck
      </p>
    </div>
  );
}

function CalledCard({ message }: { message: string | null }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.18),transparent_32%)] blur-3xl" />
      <div className="relative bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-400/40 rounded-none p-7 text-center shadow-[0_14px_38px_rgba(16,185,129,0.24)]">
        <div className="w-16 h-16 rounded-none flex items-center justify-center mx-auto mb-4 bg-emerald-500/25 shadow-inner shadow-emerald-900/50">
          <svg className="w-8 h-8 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">It's your turn</h2>
        <p className="text-emerald-50/80 text-sm">{message || "Please proceed to the counter"}</p>
      </div>
    </div>
  );
}

function NearFrontBanner({ position }: { position: number }) {
  return (
    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/20 rounded-none flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="text-amber-300 font-medium">Almost your turn!</p>
          <p className="text-amber-400/70 text-sm">You're #{position} - get ready</p>
        </div>
      </div>
    </div>
  );
}

function NotificationBanner({
  isSupported,
  permission,
  isSubscribed,
  isLoading,
  onEnable,
}: {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  onEnable: () => void;
}) {
  if (!isSupported) return null;

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-none">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-none flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-emerald-300 text-sm">Notifications on — we'll alert you when called</p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-none">
        <p className="text-slate-500 text-sm">
          Notifications blocked. Enable in browser settings to get alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-teal-500/10 border border-teal-500/20 rounded-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500/20 rounded-none flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-teal-300 text-sm">Get notified when it's your turn</p>
      </div>
      <button
        onClick={onEnable}
        disabled={isLoading}
        className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-none hover:bg-teal-400 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isLoading ? "..." : "Enable"}
      </button>
    </div>
  );
}

interface QueuePositionProps {
  token: string;
}

export function QueuePosition({ token }: QueuePositionProps) {
  const { data, isLoading, error, connectionState, refresh } = useQueuePosition(token);
  const pushNotifications = usePushNotifications(token);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border border-teal-500/30" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-transparent border-t-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center border border-red-500/30 bg-red-500/5 rounded-none px-6 py-8 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="w-16 h-16 bg-red-500/20 rounded-none flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-300/80 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-white text-slate-900 font-semibold rounded-none hover:bg-slate-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isCalled = data.status === "Called";
  const isWaiting = data.status === "Waiting";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-xl font-bold">{data.businessName}</h1>
            <p className="text-slate-500">{data.queueName}</p>
          </div>
          <ConnectionIndicator state={connectionState} />
        </div>

        {/* Near-front alert */}
        {data.nearFrontAlert && data.position && data.position > 0 && (
          <NearFrontBanner position={data.position} />
        )}

        {/* Main status */}
        <div className="mb-8">
          {isCalled ? (
            <CalledCard message={data.calledMessage} />
          ) : isWaiting && data.position ? (
            <PositionDisplay position={data.position} />
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-none p-6 text-center">
              <p className="text-slate-400">Status: {data.status}</p>
            </div>
          )}
        </div>

        {/* Notification banner */}
        {isWaiting && (
          <div className="mb-4">
            <NotificationBanner
              isSupported={pushNotifications.isSupported}
              permission={pushNotifications.permission}
              isSubscribed={pushNotifications.isSubscribed}
              isLoading={pushNotifications.isLoading}
              onEnable={pushNotifications.subscribe}
            />
          </div>
        )}

        {/* Welcome message */}
        {data.welcomeMessage && isWaiting && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-none">
            <p className="text-slate-400 text-sm">{data.welcomeMessage}</p>
          </div>
        )}

        {/* Offline refresh */}
        {connectionState === "disconnected" && (
          <button
            onClick={refresh}
            className="w-full mt-4 py-4 bg-slate-800 text-white font-medium rounded-none border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            Refresh Position
          </button>
        )}
      </div>
    </div>
  );
}
