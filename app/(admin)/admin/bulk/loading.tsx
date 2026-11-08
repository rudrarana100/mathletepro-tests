export default function AdminBulkLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
      <div className="h-8 w-44 bg-zinc-900 rounded-md" />
      <div className="h-64 bg-zinc-950 border border-zinc-900 rounded-md p-6 space-y-4">
        <div className="h-6 w-56 bg-zinc-900 rounded" />
        <div className="h-32 bg-zinc-900/40 rounded-md border border-dashed border-zinc-800" />
      </div>
    </div>
  );
}
