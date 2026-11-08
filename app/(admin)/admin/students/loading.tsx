export default function AdminStudentsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      <div className="space-y-2 border-b border-zinc-900 pb-4">
        <div className="h-6 w-32 bg-zinc-900 rounded" />
      </div>

      <div className="h-10 w-72 bg-zinc-950 border border-zinc-800 rounded-md" />

      <div className="border border-zinc-800 bg-zinc-950 rounded-md p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-zinc-900/40 rounded border border-zinc-900" />
        ))}
      </div>
    </div>
  );
}
