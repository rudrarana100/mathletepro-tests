export default function AdminTestsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-32 bg-zinc-900 rounded" />
      </div>

      <div className="h-20 bg-zinc-950 border border-zinc-800 rounded-md p-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-3">
            <div className="h-5 w-2/3 bg-zinc-900 rounded" />
            <div className="h-4 w-1/3 bg-zinc-900/60 rounded" />
            <div className="h-8 w-full bg-zinc-900/40 rounded mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
