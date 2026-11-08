export default function AdminAnalyticsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-32 bg-zinc-900 rounded" />
      </div>

      <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-md p-4" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-2">
            <div className="h-3 w-24 bg-zinc-900 rounded" />
            <div className="h-6 w-16 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>

      <div className="h-72 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-3">
        <div className="h-4 w-48 bg-zinc-900 rounded" />
        <div className="h-48 bg-zinc-900/30 rounded" />
      </div>
    </div>
  );
}
