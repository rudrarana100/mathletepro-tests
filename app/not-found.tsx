import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass, LayoutDashboard } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-zinc-800 selection:text-white">
      <div className="max-w-md w-full border border-zinc-800 bg-zinc-950 p-8 space-y-6 rounded-none text-center">
        <div className="w-12 h-12 bg-black border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
          <Compass className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 font-bold">
            404 // NOT FOUND
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-sans">
            Inquiry Locus Missing
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            The requested examination, scorecard, or endpoint cannot be resolved within this semester repository.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/dashboard">
            <Button className="w-full h-11 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>RETURN TO DASHBOARD</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
