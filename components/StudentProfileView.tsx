"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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

export interface StudentProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  testsCompletedCount: number;
  averageScore: number;
}

export default function StudentProfileView({
  profile,
}: {
  profile: StudentProfileData;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

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
        setShowPasswordForm(false);
      }
    } catch {
      setPasswordError("Failed to update password. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Section C.3: Format dates as "7 Nov 2026"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Student Profile"
        description="Personal account details and academic examination record"
        breadcrumbs={[
          { label: "Mathlete Pro", href: "/student/tests" },
          { label: "Profile" },
        ]}
      />

      {/* Main Profile Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 sm:p-8 space-y-8">
        {/* User Identity Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 font-semibold text-xl">
              {profile.email ? profile.email[0].toUpperCase() : "S"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {profile.full_name || profile.email.split("@")[0]}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-400 font-normal">
                  {profile.email}
                </span>
                <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 rounded">
                  {profile.role === "admin" ? "Faculty" : "Student"}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-medium h-9"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
          </Button>
        </div>

        {/* Academic Performance Strip */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <Award className="w-3.5 h-3.5 text-zinc-500" />
              <span>Tests completed</span>
            </div>
            <div className="text-2xl font-semibold text-zinc-100 tabular-nums">
              {profile.testsCompletedCount}
            </div>
          </div>

          <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Average score</span>
            </div>
            <div className="text-2xl font-semibold text-emerald-400 tabular-nums">
              {profile.averageScore > 0 ? `+${profile.averageScore}` : profile.averageScore}
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Account information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-zinc-900 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Mail className="w-3.5 h-3.5" />
                <span>Email address</span>
              </div>
              <div className="text-sm font-medium text-zinc-200">
                {profile.email}
              </div>
            </div>

            <div className="p-4 border border-zinc-900 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>Member since</span>
              </div>
              <div className="text-sm font-medium text-zinc-200 tabular-nums">
                {formatDate(profile.created_at)}
              </div>
            </div>

            <div className="p-4 border border-zinc-900 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Shield className="w-3.5 h-3.5" />
                <span>System role</span>
              </div>
              <div className="text-sm font-medium text-zinc-200 capitalize">
                {profile.role}
              </div>
            </div>

            <div className="p-4 border border-zinc-900 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <User className="w-3.5 h-3.5" />
                <span>Student ID</span>
              </div>
              <div className="text-xs font-mono text-zinc-400 truncate">
                {profile.id}
              </div>
            </div>
          </div>
        </div>

        {/* Security / Password Section */}
        <div className="space-y-4 pt-4 border-t border-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Security & credentials
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Manage your account authentication password
              </p>
            </div>

            <Button
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
              variant="outline"
              size="sm"
              className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-medium h-8"
            >
              <Key className="w-3 h-3 mr-1.5" />
              {showPasswordForm ? "Cancel" : "Change password"}
            </Button>
          </div>

          {passwordSuccess && (
            <div className="p-3 border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs rounded-md flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 border border-rose-500/30 bg-rose-950/20 text-rose-400 text-xs rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {showPasswordForm && (
            <form onSubmit={handlePasswordUpdate} className="p-4 border border-zinc-900 bg-zinc-900/30 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">New password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Confirm new password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isUpdatingPassword}
                size="sm"
                className="rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium h-8"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Save new password</span>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
