import { memo } from "react";
import type { Customer } from "../hooks/useStaffQueue";

interface CustomerCardProps {
  customer: Customer;
  queueName?: string;
  onMarkServed?: (id: string) => void;
  onMarkNoShow?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const CustomerCard = memo(function CustomerCard({
  customer,
  queueName,
  onMarkServed,
  onMarkNoShow,
  onRemove,
}: CustomerCardProps) {
  const isCalled = customer.status === "Called";
  const isWaiting = customer.status === "Waiting";

  return (
    <div
      className={`border rounded-none p-4 transition-all ${
        isCalled
          ? "bg-amber-500/10 border-amber-500/20 shadow-[0_12px_32px_rgba(245,158,11,0.15)]"
          : "bg-slate-900 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Position / Status indicator */}
          {isWaiting && customer.position && (
            <div className="w-12 h-12 bg-slate-800 rounded-none flex items-center justify-center font-bold text-lg text-white">
              {customer.position}
            </div>
          )}
          {isCalled && (
            <div className="w-12 h-12 bg-amber-500/20 rounded-none flex items-center justify-center">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            </div>
          )}

          {/* Customer info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{customer.name}</h3>
            <p className="text-sm text-slate-500">
              {formatTime(customer.joinedAt)}
              {customer.calledAt && ` · Called ${formatTime(customer.calledAt)}`}
            </p>

            {/* Tags */}
            {(queueName || customer.partySize || customer.notes) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {queueName && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-teal-500/20 rounded-none text-xs text-teal-400 font-medium">
                    {queueName}
                  </span>
                )}
                {customer.partySize && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 rounded-none text-xs text-slate-400">
                    Party of {customer.partySize}
                  </span>
                )}
                {customer.notes && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 rounded-none text-xs text-slate-400 italic max-w-[200px] truncate">
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
              className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-none hover:bg-emerald-400 transition-colors"
            >
              Done
            </button>
          )}
          {isCalled && onMarkNoShow && (
            <button
              onClick={() => onMarkNoShow(customer.id)}
              className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-medium rounded-none hover:bg-slate-600 transition-colors"
            >
              No-show
            </button>
          )}
          {isWaiting && onRemove && (
            <button
              onClick={() => onRemove(customer.id)}
              className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-none hover:bg-red-500/20 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
