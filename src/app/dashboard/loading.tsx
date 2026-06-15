function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="hidden gap-3 sm:flex">
          <SkeletonBlock className="h-10 w-32" />
          <SkeletonBlock className="h-10 w-40" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-40" />
          <SkeletonBlock className="h-9 w-36" />
        </div>
        <SkeletonBlock className="h-4 w-32" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="mt-3 h-8 w-14" />
              </div>
              <SkeletonBlock className="h-9 w-9" />
            </div>
            <SkeletonBlock className="mt-4 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="mt-4 h-40 w-full" />
          </div>
        ))}
      </div>

      <div>
        <SkeletonBlock className="mb-3 h-5 w-32" />
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-4 border-b border-slate-100 p-4 last:border-b-0">
              <SkeletonBlock className="h-5" />
              <SkeletonBlock className="h-5" />
              <SkeletonBlock className="h-5" />
              <SkeletonBlock className="h-5" />
              <SkeletonBlock className="h-5" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    </div>
  );
}
