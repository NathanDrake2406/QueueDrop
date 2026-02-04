interface Queue {
  name: string;
  slug: string;
  waitingCount: number;
  estimatedWaitMinutes: number;
}

interface QueueSelectorProps {
  businessName: string;
  queues: Queue[];
  onSelect: (queueSlug: string) => void;
}

export function QueueSelector({ businessName, queues, onSelect }: QueueSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-teal-400 font-medium mb-2">{businessName}</p>
        <h2 className="text-2xl font-bold">Choose a queue</h2>
        <p className="text-slate-500 mt-2">Select which line you'd like to join</p>
      </div>

      <div className="space-y-3">
        {queues.map((queue) => (
          <button
            key={queue.slug}
            onClick={() => onSelect(queue.slug)}
            className="w-full p-5 bg-slate-900 border border-slate-800 rounded-none hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-white group-hover:text-teal-400 transition-colors">
                  {queue.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {queue.waitingCount} waiting
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    ~{queue.estimatedWaitMinutes} min
                  </span>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-slate-600 group-hover:text-teal-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
