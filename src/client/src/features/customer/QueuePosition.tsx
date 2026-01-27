import { useParams } from "react-router-dom";
import { useQueuePosition } from "./hooks/useQueuePosition";
import { usePushNotifications } from "./hooks/usePushNotifications";

function ConnectionIndicator({ state }: { state: "connecting" | "connected" | "reconnecting" | "disconnected" }) {
  const colors = {
    connected: "bg-emerald-500",
    connecting: "bg-amber-500 animate-pulse",
    reconnecting: "bg-amber-500 animate-pulse",
    disconnected: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[state]}`} />
      <span className="text-xs text-zinc-500 uppercase tracking-wide">
        {state === "connected" ? "Live" : state}
      </span>
    </div>
  );
}

function PositionDisplay({ position }: { position: number }) {
  return (
    <div className="text-center py-8">
      <p className="text-zinc-500 text-sm uppercase tracking-wider mb-4">Your position</p>
      <div className="relative inline-block">
        <div className="text-[140px] font-bold leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          {position}
        </div>
        <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 blur-3xl -z-10" />
      </div>
      <p className="text-zinc-400 mt-4">
        {position === 1 ? "You're next!" : `${position - 1} ${position - 1 === 1 ? "person" : "people"} ahead`}
      </p>
    </div>
  );
}

function CalledCard({ message }: { message: string | null }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-20 blur-3xl" />
      <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-8 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-3">It's Your Turn!</h2>
        <p className="text-emerald-200/80 text-lg">{message || "Please proceed to the counter"}</p>
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
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
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
      <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl">
        <p className="text-zinc-500 text-sm">
          Notifications blocked. Enable in browser settings to get alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p className="text-violet-300 text-sm">Get notified when it's your turn</p>
      </div>
      <button
        onClick={onEnable}
        disabled={isLoading}
        className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-400 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isLoading ? "..." : "Enable"}
      </button>
    </div>
  );
}

export function QueuePosition() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error, connectionState, refresh } = useQueuePosition(token || "");
  const pushNotifications = usePushNotifications(token || null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-zinc-500 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-colors"
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-xl font-bold">{data.businessName}</h1>
            <p className="text-zinc-500">{data.queueName}</p>
          </div>
          <ConnectionIndicator state={connectionState} />
        </div>

        {/* Main status */}
        <div className="mb-8">
          {isCalled ? (
            <CalledCard message={data.calledMessage} />
          ) : isWaiting && data.position ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <PositionDisplay position={data.position} />
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
              <p className="text-zinc-400">Status: {data.status}</p>
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
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <p className="text-zinc-400 text-sm">{data.welcomeMessage}</p>
          </div>
        )}

        {/* Offline refresh */}
        {connectionState === "disconnected" && (
          <button
            onClick={refresh}
            className="w-full mt-4 py-4 bg-zinc-800 text-white font-medium rounded-2xl hover:bg-zinc-700 transition-colors"
          >
            Refresh Position
          </button>
        )}
      </div>
    </div>
  );
}
