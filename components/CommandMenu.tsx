"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  BookOpen,
  Award,
  User,
  Shield,
  Layers,
  HelpCircle,
  Users,
  TrendingUp,
  Key,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Tests" | "Actions";
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export default function CommandMenu({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"admin" | "student">("student");
  const [tests, setTests] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.role === "admin") {
            setRole("admin");
          } else {
            setRole("student");
          }
        }

        const { data: testData } = await supabase
          .from("tests")
          .select("id, title")
          .eq("is_published", true)
          .limit(10);

        if (testData && testData.length > 0) {
          setTests(testData);
        } else {
          setTests([]);
        }
      } catch {
        setTests([]);
      }
    }
    loadData();
  }, [supabase]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/auth/login");
    router.refresh();
  };

  const studentItems: CommandItem[] = [
    {
      id: "nav-available-tests",
      title: "Available tests",
      category: "Navigation",
      href: "/student/tests",
      icon: BookOpen,
    },
    {
      id: "nav-my-results",
      title: "My results & scorecards",
      category: "Navigation",
      href: "/student/results",
      icon: Award,
    },
    {
      id: "nav-student-profile",
      title: "Student profile",
      category: "Navigation",
      href: "/student/profile",
      icon: User,
    },
    {
      id: "nav-password",
      title: "Update password",
      category: "Navigation",
      href: "/auth/update-password",
      icon: Key,
    },
    {
      id: "action-logout",
      title: "Sign out",
      category: "Actions",
      action: handleLogout,
      icon: LogOut,
    },
  ];

  const adminItems: CommandItem[] = [
    {
      id: "nav-admin-overview",
      title: "Faculty overview",
      category: "Navigation",
      href: "/admin",
      icon: Shield,
    },
    {
      id: "nav-admin-tests",
      title: "Test management",
      category: "Navigation",
      href: "/admin/tests",
      icon: Layers,
    },
    {
      id: "nav-admin-questions",
      title: "Question bank",
      category: "Navigation",
      href: "/admin/questions",
      icon: HelpCircle,
    },
    {
      id: "nav-admin-students",
      title: "Student directory",
      category: "Navigation",
      href: "/admin/students",
      icon: Users,
    },
    {
      id: "nav-admin-analytics",
      title: "Analytics & results",
      category: "Navigation",
      href: "/admin/analytics",
      icon: TrendingUp,
    },
    {
      id: "nav-password",
      title: "Update password",
      category: "Navigation",
      href: "/auth/update-password",
      icon: Key,
    },
    {
      id: "action-logout",
      title: "Sign out",
      category: "Actions",
      action: handleLogout,
      icon: LogOut,
    },
  ];

  const baseItems = role === "admin" ? adminItems : studentItems;

  const testItems: CommandItem[] =
    role === "student"
      ? tests.map((t) => ({
          id: `test-${t.id}`,
          title: `Start examination: ${t.title}`,
          category: "Tests" as const,
          href: `/exam?testId=${t.id}`,
          icon: BookOpen,
        }))
      : [];

  const allItems = [...baseItems, ...testItems];

  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filtered[selectedIndex];
      if (current) {
        onClose();
        if (current.action) {
          current.action();
        } else if (current.href) {
          router.push(current.href);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/40">
          <Search className="w-4 h-4 text-zinc-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, test title, or jump to page..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-normal"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-900 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-normal">
              No matching pages or examinations found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    if (item.action) {
                      item.action();
                    } else if (item.href) {
                      router.push(item.href);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-md transition-colors text-sm ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100 font-medium"
                      : "text-zinc-300 hover:bg-zinc-900/60 hover:text-white font-normal"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className="w-4 h-4 shrink-0 text-zinc-400" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
                    <span>{item.category}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-zinc-900 px-4 py-2 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500 font-normal">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Mathlete Pro QuickNav</span>
        </div>
      </div>
    </div>
  );
}
