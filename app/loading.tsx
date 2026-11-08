export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 space-y-3 font-sans">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-200 animate-spin rounded-full" />
      <div className="text-sm text-zinc-400 font-normal">
        Loading...
      </div>
    </div>
  );
}
