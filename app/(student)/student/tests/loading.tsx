export default function StudentTestsLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-44 bg-zinc-900 rounded" />
        <div className="h-4 w-60 bg-zinc-900/60 rounded" />
      </div>

      {/* 4 Metric cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-3">
            <div className="h-3 w-24 bg-zinc-900 rounded" />
            <div className="h-7 w-16 bg-zinc-800 rounded" />
            <div className="h-3 w-32 bg-zinc-900/60 rounded" />
          </div>
        ))}
      </div>

      {/* Test cards skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-36 bg-zinc-900 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="h-5 w-3/4 bg-zinc-900 rounded" />
              <div className="h-4 w-1/2 bg-zinc-900/60 rounded" />
              <div className="h-9 w-full bg-zinc-900 rounded mt-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
