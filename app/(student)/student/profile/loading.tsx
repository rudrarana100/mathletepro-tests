export default function StudentProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-36 bg-zinc-900 rounded" />
        <div className="h-4 w-72 bg-zinc-900/60 rounded" />
      </div>

      {/* Main card skeleton */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 sm:p-8 space-y-8">
        <div className="flex items-center gap-4 pb-6 border-b border-zinc-900">
          <div className="w-14 h-14 rounded-lg bg-zinc-900" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-zinc-900 rounded" />
            <div className="h-4 w-52 bg-zinc-900/60 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-zinc-900/40 rounded-lg" />
          <div className="h-24 bg-zinc-900/40 rounded-lg" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-zinc-900/20 border border-zinc-900 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
