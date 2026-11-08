"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/student/tests");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred updating password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center">
              M
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-200">
              Mathlete Pro
            </span>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
            Update password
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm font-normal">
            Enter a new secure password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-normal text-zinc-300">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="New password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border-zinc-800 bg-zinc-900/60 text-zinc-100 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-normal text-zinc-300">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border-zinc-800 bg-zinc-900/60 text-zinc-100 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 h-10"
              />
            </div>

            {error && (
              <div className="p-3 border border-red-500/20 bg-red-950/30 text-red-400 text-sm rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors mt-2"
            >
              {isLoading ? "Updating password..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
