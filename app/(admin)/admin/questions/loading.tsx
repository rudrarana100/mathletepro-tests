export default function AdminQuestionsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-32 bg-zinc-900 rounded" />
      </div>

      <div className="h-16 bg-zinc-950 border border-zinc-800 rounded-md p-4" />

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-zinc-950 border border-zinc-800 rounded-md p-5 space-y-3">
            <div className="h-4 w-3/4 bg-zinc-900 rounded" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="h-8 bg-zinc-900/40 rounded" />
              <div className="h-8 bg-zinc-900/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
