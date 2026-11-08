"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import CommandMenu from "@/components/CommandMenu";
import {
  Shield,
  Layers,
  HelpCircle,
  Users,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  FileSpreadsheet,
} from "lucide-react";

interface AdminSidebarProps {
  children: React.ReactNode;
  userEmail?: string;
  role?: string;
}

export default function AdminSidebar({
  children,
  userEmail: initialUserEmail,
  role: initialRole,
}: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [userEmail] = useState<string | null>(initialUserEmail ?? "faculty@mathletepro.com");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("mathlete_admin_sidebar_collapsed");
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === "true");
    }
  }, []);

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleCollapsed = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("mathlete_admin_sidebar_collapsed", nextState.toString());
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/auth/login");
    router.refresh();
  };

  // Plain wording per Section C.2: "Faculty console" -> "Dashboard"
  // Section B.2: Remove "Take exam" from admin sidebar
  const navItems = [
    { label: "Overview", href: "/admin", icon: Shield },
    { label: "Tests", href: "/admin/tests", icon: Layers },
    { label: "Questions", href: "/admin/questions", icon: HelpCircle },
    { label: "Upload from Excel", href: "/admin/bulk", icon: FileSpreadsheet },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col md:flex-row selection:bg-zinc-800 selection:text-white">
      {/* Mobile Top Navbar with Hamburger */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center">
            M
          </div>
          <span className="font-semibold tracking-tight text-sm text-zinc-100">Mathlete Pro</span>
          <span className="text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 border border-emerald-500/20 bg-emerald-950/20 rounded-sm uppercase tracking-wider">
            Faculty
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandOpen(true)}
            className="p-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
            title="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden flex"
          onClick={() => setIsMobileOpen(false)}
        >
          <div
            className="w-72 bg-zinc-950 border-r border-zinc-800 h-full p-6 flex flex-col justify-between animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
                <div>
                  <div className="text-base font-semibold tracking-tight text-zinc-100">
                    Mathlete Pro
                  </div>
                  <div className="text-xs text-zinc-500 font-normal">
                    Dashboard
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 border border-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Navigation with next/link prefetching */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin" || pathname === "/admin/overview"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      prefetch={true}
                      onClick={() => setIsMobileOpen(false)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${
                        isActive
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="pt-6 border-t border-zinc-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 font-medium text-xs flex items-center justify-center shrink-0">
                  {userEmail ? userEmail[0].toUpperCase() : "A"}
                </div>
                <div className="truncate">
                  <div className="text-sm text-zinc-200 font-normal truncate">{userEmail}</div>
                  <div className="text-xs text-emerald-400 font-medium">
                    Faculty
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full rounded-md text-sm font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 h-9"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between border-r border-zinc-800 bg-zinc-950 transition-all duration-300 sticky top-0 h-screen shrink-0 ${
          isCollapsed ? "w-20 p-4" : "w-64 p-5"
        }`}
      >
        <div className="space-y-6">
          {/* Header & Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center">
                  M
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight text-zinc-100">
                    Mathlete Pro
                  </div>
                  <div className="text-xs text-zinc-500 font-normal">
                    Dashboard
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              className="p-1.5 border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-100 rounded-md transition-colors mx-auto"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Search */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className={`w-full border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors flex items-center justify-between ${
              isCollapsed ? "p-2 justify-center" : "px-3 py-2 text-xs"
            }`}
            title="Search command menu (Cmd+K)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              {!isCollapsed && <span className="truncate">Quick search...</span>}
            </div>
            {!isCollapsed && (
              <kbd className="px-1.5 py-0.5 text-[10px] text-zinc-500 border border-zinc-800 bg-black rounded">
                ⌘K
              </kbd>
            )}
          </button>

          {/* Nav Items with next/link prefetching */}
          <nav className="space-y-1">
            {!isCollapsed && (
              <div className="text-xs text-zinc-500 font-normal px-3 py-1">
                Faculty modules
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin" || pathname === "/admin/overview"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={true}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 rounded-md transition-colors ${
                    isCollapsed ? "p-2.5 justify-center" : "px-3 py-2 text-sm font-medium text-left"
                  } ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="pt-5 border-t border-zinc-900 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 font-medium text-xs flex items-center justify-center shrink-0">
              {userEmail ? userEmail[0].toUpperCase() : "A"}
            </div>
            {!isCollapsed && (
              <div className="truncate flex-1">
                <div className="text-xs text-zinc-200 font-normal truncate" title={userEmail || ""}>
                  {userEmail}
                </div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  Faculty admin
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className={`w-full rounded-md text-sm font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 h-9 transition-colors ${
              isCollapsed ? "px-0" : "px-3"
            }`}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto bg-black p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Global Cmd+K Search Modal */}
      <CommandMenu isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </div>
  );
}
