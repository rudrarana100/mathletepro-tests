"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import CommandMenu from "@/components/CommandMenu";
import {
  LayoutDashboard,
  Award,
  User,
  BarChart3,
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
} from "lucide-react";

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // 1. Initial Load & Restore Persisted Collapsed State
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("mathlete_sidebar_collapsed");
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === "true");
    }

    const getUserData = async () => {
      // Check demo user cookie first
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
      };
      const demoVal = getCookie("mathlete_demo_user");
      if (demoVal) {
        try {
          const parsed = JSON.parse(demoVal);
          setUserEmail(parsed.email || "demo@mathletepro.com");
          setRole(parsed.role || "student");
          return;
        } catch {
          // ignore
        }
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email ?? "User");
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile) setRole(profile.role);
        }
      } catch {
        // Fallback to default student role
        setUserEmail("student@mathletepro.com");
        setRole("student");
      }
    };
    getUserData();
  }, [supabase]);

  // 2. Global Cmd+K keyboard shortcut
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
    localStorage.setItem("mathlete_sidebar_collapsed", nextState.toString());
  };

  const handleLogout = async () => {
    document.cookie = "mathlete_demo_user=; path=/; max-age=0";
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/auth/login");
    router.refresh();
  };

  // Student Navigation Items
  const studentNav = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My History", href: "/history", icon: Award },
    { label: "Profile & Security", href: "/auth/update-password", icon: User },
  ];

  // Admin Navigation Items
  const adminNav = [
    { label: "Overview", href: "/admin#overview", icon: BarChart3 },
    { label: "Test Series", href: "/admin#tests", icon: Layers },
    { label: "Question Bank", href: "/admin#questions", icon: HelpCircle },
    { label: "Students", href: "/admin#students", icon: Users },
    { label: "Analytics", href: "/admin#analytics", icon: TrendingUp },
  ];

  const currentNav = role === "admin" ? adminNav : studentNav;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-zinc-800 selection:text-white">
      {/* Mobile Top Navbar with Hamburger */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white text-black font-black text-xs flex items-center justify-center font-mono">
            M
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">Mathlete Pro</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandOpen(true)}
            className="p-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-none"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-none"
            title="Open Menu"
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
                  <div className="text-lg font-black tracking-tighter text-white uppercase">
                    Mathlete Pro
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-semibold">
                    {role === "admin" ? "Faculty Control" : "Student Portal"}
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 border border-zinc-800 text-zinc-400 hover:text-white rounded-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="space-y-1.5">
                {currentNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setIsMobileOpen(false);
                        router.push(item.href);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 text-xs font-mono font-bold uppercase tracking-wider rounded-none border transition-colors ${
                        isActive
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="pt-6 border-t border-zinc-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-zinc-800 bg-zinc-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {userEmail ? userEmail[0].toUpperCase() : "U"}
                </div>
                <div className="truncate">
                  <div className="text-xs text-zinc-200 font-mono truncate">{userEmail}</div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    {role || "Student"}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full rounded-none text-xs font-mono font-bold tracking-wider uppercase h-10"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" /> Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between border-r border-zinc-800 bg-zinc-950 transition-all duration-300 sticky top-0 h-screen shrink-0 ${
          isCollapsed ? "w-20 p-4" : "w-64 p-6"
        }`}
      >
        <div className="space-y-6">
          {/* Header & Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            {!isCollapsed && (
              <div>
                <div className="text-xl font-black tracking-tighter text-white uppercase">
                  Mathlete Pro
                </div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-semibold">
                  {role === "admin" ? "Faculty Panel" : "Student Portal"}
                </div>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              className="p-1.5 border border-zinc-800 bg-black text-zinc-400 hover:text-white hover:border-zinc-600 rounded-none text-xs font-bold transition-colors mx-auto"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Cmd+K Quick Search Button */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className={`w-full border border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-none transition-colors flex items-center justify-between ${
              isCollapsed ? "p-2 justify-center" : "px-3 py-2 text-xs font-mono"
            }`}
            title="Search Command Menu (Cmd+K)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              {!isCollapsed && <span className="truncate">QuickNav...</span>}
            </div>
            {!isCollapsed && (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 border border-zinc-800 bg-black rounded-none">
                ⌘K
              </kbd>
            )}
          </button>

          {/* Grouped Nav Items */}
          <nav className="space-y-1">
            {!isCollapsed && (
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-bold px-3 py-1">
                {role === "admin" ? "Management" : "Portal Modules"}
              </div>
            )}
            {currentNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 rounded-none border transition-colors ${
                    isCollapsed ? "p-3 justify-center" : "px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-left"
                  } ${
                    isActive
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="pt-6 border-t border-zinc-900 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-zinc-800 bg-black text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              {userEmail ? userEmail[0].toUpperCase() : "U"}
            </div>
            {!isCollapsed && (
              <div className="truncate flex-1">
                <div className="text-xs text-zinc-200 font-mono truncate" title={userEmail || ""}>
                  {userEmail}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-semibold">
                  {role === "admin" ? "Faculty" : "Student"}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleLogout}
            variant="destructive"
            className={`w-full rounded-none font-mono text-xs font-bold uppercase tracking-wider h-10 ${
              isCollapsed ? "px-0" : "px-4"
            }`}
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="ml-2">LOGOUT</span>}
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