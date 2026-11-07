"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Mail, Shield, Calendar, Award, Key, LogOut } from "lucide-react";

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  testsCompletedCount: number;
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id, full_name, role, created_at")
          .eq("id", user.id)
          .maybeSingle();

        const { count } = await supabase
          .from("test_results")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id);

        setProfile({
          id: user.id,
          email: user.email || "",
          full_name: profileRow?.full_name || user.email?.split("@")[0] || "Student",
          role: profileRow?.role || "student",
          created_at: profileRow?.created_at || user.created_at || new Date().toISOString(),
          testsCompletedCount: count || 0,
        });
      } catch {
        // Handled gracefully
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [supabase, router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/auth/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Student Profile"
          badge="ACADEMIC RECORD"
          description="Institutional identification and authentication record"
        />
        <div className="p-12 border border-zinc-800 bg-zinc-950 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">
          Loading student credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Student Profile"
        badge="ACADEMIC RECORD"
        description="Institutional candidate credentials and examination account status"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: ID Card */}
        <Card className="rounded-none border-zinc-800 bg-zinc-950 text-white md:col-span-1 flex flex-col justify-between">
          <CardHeader className="space-y-3 pb-4">
            <div className="w-16 h-16 border border-zinc-800 bg-black text-white font-mono font-bold text-2xl flex items-center justify-center">
              {profile?.email ? profile.email[0].toUpperCase() : "S"}
            </div>
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">
                {profile?.full_name}
              </CardTitle>
              <CardDescription className="text-zinc-400 font-mono text-xs break-all">
                {profile?.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500 uppercase">Status</span>
              <span className="px-2 py-0.5 border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 uppercase font-bold text-[10px]">
                Enrolled Active
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-500 uppercase">Role</span>
              <span className="px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 uppercase font-bold text-[10px]">
                {profile?.role}
              </span>
            </div>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full rounded-none font-mono text-xs font-bold uppercase tracking-wider h-9 mt-4"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" /> End Session
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Account Details & Security */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-none border-zinc-800 bg-zinc-950 text-white">
            <CardHeader className="pb-3 border-b border-zinc-900">
              <CardTitle className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-300 flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-400" />
                Candidate Verification Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between py-2 border-b border-zinc-900">
                <span className="text-zinc-500 uppercase flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Registered Email
                </span>
                <span className="text-zinc-200 font-semibold">{profile?.email}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-zinc-900">
                <span className="text-zinc-500 uppercase flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Access Tier
                </span>
                <span className="text-zinc-200 font-semibold uppercase">
                  Candidate (Standard Examination Permissions)
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-zinc-900">
                <span className="text-zinc-500 uppercase flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Registration Timestamp
                </span>
                <span className="text-zinc-200">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-500 uppercase flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" /> Total Tests Completed
                </span>
                <span className="text-emerald-400 font-bold">
                  {profile?.testsCompletedCount} Submissions
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-zinc-800 bg-zinc-950 text-white">
            <CardHeader className="pb-3 border-b border-zinc-900">
              <CardTitle className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-zinc-400" />
                Account Security & Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 font-mono text-xs">
              <p className="text-zinc-400 leading-relaxed font-sans">
                To update your password or refresh authentication tokens, proceed to the secure credential update form.
              </p>
              <div className="pt-2">
                <Link href="/auth/update-password">
                  <Button
                    variant="outline"
                    className="rounded-none border-zinc-700 bg-black text-white hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider"
                  >
                    <Key className="w-3.5 h-3.5 mr-2" /> Change Password
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
