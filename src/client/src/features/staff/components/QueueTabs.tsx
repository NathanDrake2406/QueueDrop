interface QueueTab {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
}

interface QueueTabsProps {
  queues: QueueTab[];
  activeQueueId: string | null;
  onSelectQueue: (queueId: string | null) => void;
}

export function QueueTabs({ queues, activeQueueId, onSelectQueue }: QueueTabsProps) {
  const totalWaiting = queues.reduce((sum, q) => sum + q.waitingCount, 0);

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {/* All queues tab */}
      <button
        onClick={() => onSelectQueue(null)}
        className={`px-4 py-2 rounded-none font-medium text-sm transition-all border ${
          activeQueueId === null
            ? "bg-emerald-500/20 border-emerald-400/40 text-white shadow-[0_14px_30px_rgba(16,185,129,0.25)]"
            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-400/30 hover:text-white"
        }`}
      >
        All
        {totalWaiting > 0 && (
          <span
            className={`ml-2 px-2 py-0.5 rounded-full text-xs tabular-nums border ${
              activeQueueId === null
                ? "bg-emerald-500/25 text-emerald-50 border-transparent"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {totalWaiting}
          </span>
        )}
      </button>

      {/* Individual queue tabs */}
      {queues.map((queue) => (
        <button
          key={queue.queueId}
          onClick={() => onSelectQueue(queue.queueId)}
          className={`px-4 py-2 rounded-none font-medium text-sm transition-all border ${
            activeQueueId === queue.queueId
              ? "bg-emerald-500/20 border-emerald-400/40 text-white shadow-[0_14px_30px_rgba(16,185,129,0.25)]"
              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-emerald-400/30 hover:text-white"
          }`}
        >
          {queue.name}
          {queue.waitingCount > 0 && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs tabular-nums border ${
                activeQueueId === queue.queueId
                  ? "bg-emerald-500/25 text-emerald-50 border-transparent"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {queue.waitingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
