"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Award,
  Key,
  LogOut,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  testsCompletedCount: number;
  averageScore: number;
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inline password update state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

        const { data: results } = await supabase
          .from("test_results")
          .select("score")
          .eq("student_id", user.id);

        const count = results?.length || 0;
        const avg =
          count > 0
            ? Math.round(results!.reduce((acc, r) => acc + (r.score || 0), 0) / count)
            : 0;

        setProfile({
          id: user.id,
          email: user.email || "",
          full_name: profileRow?.full_name || user.email?.split("@")[0] || "Student",
          role: profileRow?.role || "student",
          created_at: profileRow?.created_at || user.created_at || new Date().toISOString(),
          testsCompletedCount: count,
          averageScore: avg,
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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess("Password updated successfully.");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordSuccess(null);
        }, 2000);
      }
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Profile"
          badge="STUDENT"
          description="Account credentials and performance overview"
        />
        <div className="p-12 border border-zinc-800 bg-zinc-950 text-center text-xs text-zinc-500 rounded-lg">
          Loading student credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Profile"
        badge="STUDENT"
        description="Account credentials and performance overview"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Overview Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 flex flex-col justify-between space-y-6 md:col-span-1">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-xl font-semibold flex items-center justify-center">
              {profile?.email ? profile.email[0].toUpperCase() : "S"}
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                {profile?.full_name}
              </h3>
              <p className="text-xs text-zinc-400 break-all font-normal mt-0.5">
                {profile?.email}
              </p>
            </div>

            <div className="pt-2 border-t border-zinc-900 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-normal">Role</span>
                <span className="px-2 py-0.5 border border-zinc-800 bg-zinc-900 text-zinc-300 font-medium text-[10px] rounded uppercase">
                  {profile?.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-normal">Status</span>
                <span className="px-2 py-0.5 border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-medium text-[10px] rounded uppercase">
                  Active
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-medium h-9"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
          </Button>
        </div>

        {/* Right Column: Account Details, Metrics & Security */}
        <div className="md:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
            <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-2 border-b border-zinc-900 pb-3">
              <User className="w-4 h-4 text-zinc-400" />
              <span>Student details</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500 flex items-center gap-2 font-normal">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" /> Email address
                </span>
                <span className="text-zinc-200 font-medium">{profile?.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500 flex items-center gap-2 font-normal">
                  <Shield className="w-3.5 h-3.5 text-zinc-500" /> Account role
                </span>
                <span className="text-zinc-200 font-medium capitalize">
                  {profile?.role}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500 flex items-center gap-2 font-normal">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Account created
                </span>
                <span className="text-zinc-300 tabular-nums font-normal">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500 flex items-center gap-2 font-normal">
                  <Award className="w-3.5 h-3.5 text-zinc-500" /> Total tests taken
                </span>
                <span className="text-zinc-200 font-semibold tabular-nums">
                  {profile?.testsCompletedCount} {profile?.testsCompletedCount === 1 ? "test" : "tests"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-500 flex items-center gap-2 font-normal">
                  <TrendingUp className="w-3.5 h-3.5 text-zinc-500" /> Average score
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    (profile?.averageScore || 0) > 0
                      ? "text-emerald-400"
                      : (profile?.averageScore || 0) < 0
                      ? "text-rose-400"
                      : "text-zinc-200"
                  }`}
                >
                  {(profile?.averageScore || 0) > 0
                    ? `+${profile?.averageScore}`
                    : profile?.averageScore}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Password Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-zinc-400" />
                <span>Account security</span>
              </h4>
              {!showPasswordForm && (
                <Button
                  onClick={() => setShowPasswordForm(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs font-medium h-8 px-3"
                >
                  Change password
                </Button>
              )}
            </div>

            {passwordSuccess && (
              <div className="p-3 border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs rounded-md flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{passwordError}</span>
              </div>
            )}

            {showPasswordForm ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 block">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 block">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium h-8 px-4"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      "Save password"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-xs font-medium h-8 px-3"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                To update your password or authentication credentials, click Change password above or visit the dedicated{" "}
                <Link
                  href="/auth/update-password"
                  className="text-zinc-200 underline hover:text-white font-medium"
                >
                  password update page
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
