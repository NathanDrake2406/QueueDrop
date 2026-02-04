interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-slate-800 rounded-none ${className}`} />;
}

export function CustomerCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-none" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-20 h-10 rounded-none" />
      </div>
    </div>
  );
}

export function QueueControlsSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-none p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <Skeleton className="h-7 w-48 mb-3" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-8">
          <div className="text-center">
            <Skeleton className="h-10 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="text-center">
            <Skeleton className="h-10 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-14 w-32 rounded-none" />
        <Skeleton className="h-14 w-28 rounded-none" />
        <Skeleton className="h-14 w-14 rounded-none" />
      </div>
    </div>
  );
}

export function QueuePositionSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="bg-slate-900 border border-slate-800 rounded-none p-8 text-center">
          <Skeleton className="h-32 w-32 mx-auto rounded-none mb-6" />
          <Skeleton className="h-6 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <QueueControlsSkeleton />
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="space-y-3">
            <CustomerCardSkeleton />
            <CustomerCardSkeleton />
            <CustomerCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
