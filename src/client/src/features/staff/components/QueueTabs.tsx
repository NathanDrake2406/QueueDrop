interface QueueTab {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
}

interface QueueTabsProps {
  queues: QueueTab[];
  activeQueueId: string | null; // null means "All"
  onSelectQueue: (queueId: string | null) => void;
}

export function QueueTabs({ queues, activeQueueId, onSelectQueue }: QueueTabsProps) {
  const totalWaiting = queues.reduce((sum, q) => sum + q.waitingCount, 0);

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {/* All queues tab */}
      <button
        onClick={() => onSelectQueue(null)}
        className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 ${
          activeQueueId === null
            ? "bg-violet-600 text-white"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        }`}
      >
        All
        {totalWaiting > 0 && (
          <span
            className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center ${
              activeQueueId === null ? "bg-violet-500 text-white" : "bg-zinc-700 text-zinc-300"
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
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 ${
            activeQueueId === queue.queueId
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
          }`}
        >
          {queue.name}
          {queue.waitingCount > 0 && (
            <span
              className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center ${
                activeQueueId === queue.queueId ? "bg-violet-500 text-white" : "bg-zinc-700 text-zinc-300"
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
