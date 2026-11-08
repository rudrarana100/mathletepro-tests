"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6 selection:bg-zinc-800 selection:text-white font-sans">
      <div className="max-w-lg w-full border border-red-500/20 bg-zinc-950 p-8 space-y-6 rounded-lg shadow-2xl">
        <div className="flex items-center gap-3 text-red-400 text-sm font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>System error</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Something went wrong
          </h1>
          <p className="text-sm text-zinc-400 font-normal leading-relaxed bg-zinc-900/40 p-3 rounded-md border border-zinc-800">
            {error.message || "An unexpected state occurred while processing your request."}
          </p>
          {error.digest && (
            <p className="text-xs text-zinc-500 font-normal">
              Reference code: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-zinc-900">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto h-9 px-4 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </Button>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-9 px-4 rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Return home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
