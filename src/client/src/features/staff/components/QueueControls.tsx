import type { QueueInfo } from "../hooks/useStaffQueue";

interface QueueControlsProps {
  queueInfo: QueueInfo;
  onCallNext: () => void;
  onOpenSettings?: () => void;
  onOpenQRCode?: () => void;
  isConnected: boolean;
  showAllControls?: boolean; // When false (All view), hide some controls
}

export function QueueControls({ queueInfo, onCallNext, onOpenSettings, onOpenQRCode, isConnected, showAllControls = true }: QueueControlsProps) {
  const hasWaiting = queueInfo.waitingCount > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        {/* Queue info */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-white">{queueInfo.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${queueInfo.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-xs text-zinc-500 uppercase tracking-wide">
                {queueInfo.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {queueInfo.isPaused && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Paused
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-zinc-600"}`} />
              {isConnected ? "Live" : "Connecting"}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">{queueInfo.waitingCount}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Waiting</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-500">{queueInfo.calledCount}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Called</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {showAllControls && (
          <button
            onClick={onCallNext}
            disabled={!hasWaiting}
            className="flex-1 sm:flex-none px-8 py-4 bg-white text-zinc-900 rounded-2xl font-semibold hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
          >
            Call Next
          </button>
        )}
        {!showAllControls && (
          <div className="flex-1 sm:flex-none px-8 py-4 bg-zinc-800 text-zinc-500 rounded-2xl font-medium text-center">
            Select a queue to manage
          </div>
        )}
        {showAllControls && onOpenQRCode && (
          <button
            onClick={onOpenQRCode}
            className="px-6 py-4 bg-violet-600 text-white rounded-2xl font-medium hover:bg-violet-500 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z"/>
            </svg>
            QR Code
          </button>
        )}
        {showAllControls && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-6 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-medium hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
