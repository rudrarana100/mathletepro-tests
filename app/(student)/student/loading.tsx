export default function StudentLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-44 bg-zinc-900 rounded" />
        <div className="h-4 w-80 bg-zinc-900/60 rounded" />
      </div>

      {/* Grid of test cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-zinc-900 rounded" />
                <div className="h-3 w-32 bg-zinc-900/60 rounded" />
              </div>
              <div className="h-5 w-16 bg-zinc-900 rounded-sm" />
            </div>
            <div className="h-10 bg-zinc-900/30 rounded border border-zinc-900" />
            <div className="h-9 w-full bg-zinc-900 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
