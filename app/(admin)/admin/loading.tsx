export default function AdminLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-48 bg-zinc-900 rounded" />
        <div className="h-4 w-96 bg-zinc-900/60 rounded" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <div className="h-8 w-24 bg-zinc-900 rounded" />
        <div className="h-8 w-28 bg-zinc-900 rounded" />
        <div className="h-8 w-32 bg-zinc-900 rounded" />
        <div className="h-8 w-28 bg-zinc-900 rounded" />
      </div>

      {/* 4 Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-3">
            <div className="h-3 w-20 bg-zinc-900 rounded" />
            <div className="h-7 w-16 bg-zinc-800 rounded" />
            <div className="h-3 w-32 bg-zinc-900/60 rounded" />
          </div>
        ))}
      </div>

      {/* Content panel skeleton */}
      <div className="h-96 bg-zinc-950 border border-zinc-800 rounded-md p-6 space-y-4">
        <div className="h-4 w-48 bg-zinc-900 rounded" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-zinc-900/40 rounded border border-zinc-900" />
          ))}
        </div>
      </div>
    </div>
  );
}
