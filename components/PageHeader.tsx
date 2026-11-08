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
    <header className="border-b border-zinc-800 pb-5 mb-6 space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-zinc-500 font-normal">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-zinc-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-zinc-300 font-medium" : ""}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              {title}
            </h1>
            {badge && (
              <span className="px-2 py-0.5 border border-zinc-800 bg-zinc-900 text-zinc-400 text-[11px] font-medium tracking-wider uppercase rounded-sm">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-zinc-400 font-normal">
              {description}
            </p>
          )}
        </div>

        {action && <div className="flex items-center gap-2.5 shrink-0">{action}</div>}
      </div>
    </header>
  );
}
