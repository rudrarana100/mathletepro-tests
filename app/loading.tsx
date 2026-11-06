export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-white animate-spin rounded-none" />
      <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 font-bold">
        SYNCHRONIZING MATHEMATICAL ENGINE...
      </div>
    </div>
  );
}
