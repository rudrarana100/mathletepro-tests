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
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-zinc-800 selection:text-white">
      <div className="max-w-lg w-full border border-red-900/50 bg-zinc-950 p-8 space-y-6 rounded-none shadow-2xl">
        <div className="flex items-center gap-3 text-red-500 font-mono text-xs uppercase tracking-widest font-bold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>System Exception // Diagnostic Intercept</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-sans">
            Examination Engine Error
          </h1>
          <p className="text-xs text-zinc-400 font-mono leading-relaxed bg-black p-3 border border-zinc-900">
            {error.message || "An unexpected state occurred while processing your examination request."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-zinc-600 font-mono">
              Diagnostic Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-zinc-900">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto h-10 px-5 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RETRY INQUIRY</span>
          </Button>

          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-10 px-5 rounded-none border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>RETURN TO DASHBOARD</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
