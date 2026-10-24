"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  
  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? "User");
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile) setRole(profile.role);
      }
      setIsLoadingRole(false);
    };
    getUserData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex font-sans">
      {/* Hideable Sidebar */}
      <aside className={`border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between p-6 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="space-y-8">
          
          {/* Header & Toggle Button */}
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <div className="text-xl font-black tracking-tighter text-white">MATHLETE PRO</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-1">
                  {role === "admin" ? "Faculty Panel" : "Student Portal"}
                </div>
              </div>
            )}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="p-2 border border-zinc-800 bg-black text-zinc-400 hover:text-white rounded-none text-xs font-bold"
              title="Toggle Sidebar"
            >
              {isCollapsed ? "▶" : "◀"}
            </button>
          </div>

          {/* Dynamic Navigation Links based on Role */}
          <nav className="space-y-2">
            {role === "admin" ? (
              // ADMIN SPECIFIC LINKS
              <>
                <button
                  onClick={() => router.push("/admin")}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors rounded-none border ${
                    pathname === "/admin" 
                      ? "bg-white text-black border-white" 
                      : "bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  {isCollapsed ? "⚙" : "Exam Builder & Control"}
                </button>
              </>
            ) : (
              // STUDENT SPECIFIC LINKS
              <>
                <button
                  onClick={() => router.push("/dashboard")}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors rounded-none border ${
                    pathname === "/dashboard" 
                      ? "bg-white text-black border-white" 
                      : "bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  {isCollapsed ? "📝" : "Available Tests"}[cite: 1]
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="space-y-4 pt-6 border-t border-zinc-800">
          {!isCollapsed && <div className="text-xs text-zinc-400 truncate font-mono">{userEmail}</div>}
          <Button 
            onClick={handleLogout} 
            variant="destructive" 
            className="w-full rounded-none text-xs font-bold tracking-wider"
          >
            {isCollapsed ? "⎋" : "LOGOUT"}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-black p-8">
        {children}
      </main>
    </div>
  );
}