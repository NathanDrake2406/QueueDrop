import type { Customer } from "../hooks/useStaffQueue";

interface CustomerCardProps {
  customer: Customer;
  queueName?: string; // Show queue name badge when in "All" view
  onMarkServed?: (id: string) => void;
  onMarkNoShow?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CustomerCard({ customer, queueName, onMarkServed, onMarkNoShow, onRemove }: CustomerCardProps) {
  const isCalled = customer.status === "Called";
  const isWaiting = customer.status === "Waiting";

  return (
    <div
      className={`border rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01] ${
        isCalled
          ? "bg-amber-500/10 border-amber-500/20 shadow-lg shadow-amber-500/5"
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Position / Status indicator */}
          {isWaiting && customer.position && (
            <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-lg text-white">
              {customer.position}
            </div>
          )}
          {isCalled && (
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            </div>
          )}

          {/* Customer info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{customer.name}</h3>
            <p className="text-sm text-zinc-500">
              {formatTime(customer.joinedAt)}
              {customer.calledAt && ` · Called ${formatTime(customer.calledAt)}`}
            </p>

            {/* Tags */}
            {(queueName || customer.partySize || customer.notes) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {queueName && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-violet-500/20 rounded-lg text-xs text-violet-400 font-medium">
                    {queueName}
                  </span>
                )}
                {customer.partySize && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Party of {customer.partySize}
                  </span>
                )}
                {customer.notes && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-zinc-800 rounded-lg text-xs text-zinc-400 italic max-w-[200px] truncate">
                    {customer.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-4">
          {isCalled && onMarkServed && (
            <button
              onClick={() => onMarkServed(customer.id)}
              className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-400 transition-colors"
            >
              Done
            </button>
          )}
          {isCalled && onMarkNoShow && (
            <button
              onClick={() => onMarkNoShow(customer.id)}
              className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl hover:bg-zinc-600 transition-colors"
            >
              No-show
            </button>
          )}
          {isWaiting && onRemove && (
            <button
              onClick={() => onRemove(customer.id)}
              className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
