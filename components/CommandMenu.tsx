"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  LayoutDashboard,
  FileText,
  Shield,
  Key,
  LogOut,
  ChevronRight,
  BookOpen,
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
  const [tests, setTests] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch tests once for search
  useEffect(() => {
    async function loadTests() {
      try {
        const { data, error } = await supabase.from("tests").select("id, title").limit(10);
        if (!error && data && data.length > 0) {
          setTests(data);
          return;
        }
      } catch {
        // ignore
      }
      // Fallback to demo tests
      import("@/lib/demo-data").then(({ DEMO_TESTS }) => {
        setTests(DEMO_TESTS.map((t) => ({ id: t.id, title: t.title })));
      });
    }
    loadTests();
  }, [supabase]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const baseItems: CommandItem[] = [
    {
      id: "nav-dashboard",
      title: "Student Portal (Dashboard)",
      category: "Navigation",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "nav-history",
      title: "Performance Trajectory & Past Attempts",
      category: "Navigation",
      href: "/history",
      icon: FileText,
    },
    {
      id: "nav-admin",
      title: "Faculty Command Center",
      category: "Navigation",
      href: "/admin",
      icon: Shield,
    },
    {
      id: "nav-password",
      title: "Update Password & Security",
      category: "Navigation",
      href: "/auth/update-password",
      icon: Key,
    },
    {
      id: "action-logout",
      title: "Log Out of Session",
      category: "Actions",
      action: async () => {
        document.cookie = "mathlete_demo_user=; path=/; max-age=0";
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        router.push("/auth/login");
        router.refresh();
      },
      icon: LogOut,
    },
  ];

  const testItems: CommandItem[] = tests.map((t) => ({
    id: `test-${t.id}`,
    title: `Start Examination: ${t.title}`,
    category: "Tests",
    href: `/exam?testId=${t.id}`,
    icon: BookOpen,
  }));

  const allItems = [...baseItems, ...testItems];

  const filtered = allItems.filter((item) =>
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
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-none shadow-2xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800 bg-black">
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
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 border border-zinc-800 bg-zinc-900 rounded-none uppercase">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left rounded-none transition-colors font-mono text-xs ${
                    isSelected
                      ? "bg-white text-black font-bold"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] uppercase opacity-60 shrink-0">
                    <span>{item.category}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-zinc-900 px-4 py-2 bg-black/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
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
