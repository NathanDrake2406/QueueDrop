import type { QueueInfo } from "../hooks/useStaffQueue";

interface QueueControlsProps {
  queueInfo: QueueInfo;
  onCallNext?: () => void | Promise<unknown>;
  onOpenSettings?: () => void;
  onOpenQRCode?: () => void;
  isConnected: boolean;
  showAllControls?: boolean;
}

export function QueueControls({
  queueInfo,
  onCallNext,
  onOpenSettings,
  onOpenQRCode,
  isConnected,
  showAllControls = true,
}: QueueControlsProps) {
  const hasWaiting = queueInfo.waitingCount > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-6 shadow-[0_14px_40px_rgba(0,0,0,0.30)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        {/* Queue info */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-white">{queueInfo.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${queueInfo.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-[11px] text-slate-500 uppercase tracking-[0.08em]">
                {queueInfo.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {queueInfo.isPaused && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[11px] uppercase tracking-[0.08em]">Paused</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-[11px] uppercase tracking-[0.08em]">{isConnected ? "Live" : "Connecting"}</span>
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-3 rounded-none border px-4 py-2 bg-slate-800/60 border-slate-700">
            <div className="w-10 h-10 rounded-none flex items-center justify-center font-bold bg-slate-700 text-white">
              {queueInfo.waitingCount}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Waiting</p>
              <p className="text-white text-sm">In queue</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-none border px-4 py-2 bg-amber-500/10 border-amber-400/30">
            <div className="w-10 h-10 rounded-none flex items-center justify-center font-bold bg-amber-500/30 text-white">
              {queueInfo.calledCount}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-amber-300/80">Called</p>
              <p className="text-amber-100 text-sm">Awaiting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {showAllControls && onCallNext && (
          <button
            onClick={onCallNext}
            disabled={!hasWaiting}
            className="flex-1 sm:flex-none px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 rounded-none font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
          >
            Call Next
          </button>
        )}
        {!showAllControls && (
          <div className="flex-1 sm:flex-none px-8 py-4 bg-slate-800 text-slate-500 rounded-none font-medium text-center border border-slate-700">
            Select a queue to manage
          </div>
        )}
        {showAllControls && onOpenQRCode && (
          <button
            onClick={onOpenQRCode}
            className="px-6 py-4 bg-slate-800 text-white rounded-none font-medium border border-white/5 hover:border-teal-400/40 hover:bg-slate-800/80 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z" />
            </svg>
            QR Code
          </button>
        )}
        {showAllControls && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-6 py-4 bg-slate-800 text-slate-300 rounded-none font-medium border border-slate-700 hover:border-slate-600 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
