export default function StudentResultsLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-36 bg-zinc-900 rounded" />
        <div className="h-4 w-72 bg-zinc-900/60 rounded" />
      </div>

      {/* Trajectory chart skeleton */}
      <div className="h-56 bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="h-4 w-32 bg-zinc-900 rounded" />
        <div className="h-36 bg-zinc-900/30 rounded" />
      </div>

      {/* Table skeleton */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-4 space-y-3">
        <div className="h-9 w-64 bg-zinc-900 rounded mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-zinc-900/40 rounded border border-zinc-900" />
        ))}
      </div>
    </div>
  );
}
