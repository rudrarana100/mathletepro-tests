import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`border border-zinc-800 bg-zinc-950 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 rounded-none ${className}`}
    >
      <div className="w-12 h-12 bg-black border border-zinc-800 flex items-center justify-center text-zinc-400">
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-base font-bold uppercase font-mono tracking-wider text-white">
          {title}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
          {description}
        </p>
      </div>

      {actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link href={actionHref}>
              <Button className="rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-10 px-5">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-10 px-5"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
