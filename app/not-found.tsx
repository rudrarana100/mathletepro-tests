import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass, LayoutDashboard } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6 selection:bg-zinc-800 selection:text-white font-sans">
      <div className="max-w-md w-full border border-zinc-800 bg-zinc-950 p-8 space-y-6 rounded-lg text-center shadow-xl">
        <div className="w-12 h-12 rounded-lg bg-zinc-900/60 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
          <Compass className="w-5 h-5" />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-zinc-500 font-medium">
            Error 404
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Page not found
          </h1>
          <p className="text-sm text-zinc-400 font-normal leading-relaxed">
            The requested examination, scorecard, or page could not be located.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors flex items-center justify-center gap-2">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Return home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
