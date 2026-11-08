"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Student portal error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <div className="border border-zinc-800 bg-zinc-950 p-8 rounded-md space-y-6 shadow-xl">
        <div className="flex items-center gap-2.5 text-red-400 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Student portal error</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-100">
            Failed to load examination data
          </h2>
          <p className="text-xs text-zinc-400 font-normal leading-relaxed bg-zinc-900/60 p-3 rounded border border-zinc-800">
            {error.message || "An unexpected error occurred while loading your tests or examination history."}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-zinc-900">
          <Button
            onClick={() => reset()}
            size="sm"
            className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium h-8 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </Button>

          <Link href="/student/tests">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-medium h-8 flex items-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Available tests</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
