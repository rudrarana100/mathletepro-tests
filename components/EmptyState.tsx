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
      className={`border border-zinc-800 bg-zinc-950 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 rounded-lg ${className}`}
    >
      <div className="w-12 h-12 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-400">
        <Icon className="w-5 h-5" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-base font-semibold text-zinc-100">
          {title}
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed font-normal">
          {description}
        </p>
      </div>

      {actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link href={actionHref}>
              <Button className="rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm h-9 px-4 transition-colors">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm h-9 px-4 transition-colors"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
