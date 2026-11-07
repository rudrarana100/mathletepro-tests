import Link from "next/link";
import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: React.ReactNode;
  badge?: string;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  badge,
}: PageHeaderProps) {
  return (
    <header className="border-b border-zinc-800 pb-6 mb-8 space-y-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-zinc-300 font-semibold" : ""}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white uppercase">
              {title}
            </h1>
            {badge && (
              <span className="px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 font-mono text-[10px] uppercase font-bold tracking-widest">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-zinc-400 text-xs md:text-sm font-sans font-medium">
              {description}
            </p>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
