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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  onSwitchToSignUp,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  onSwitchToSignUp?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/student/tests");
        }
      } else {
        router.push("/student/tests");
      }
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred during authentication.";
      setError(msg);
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
            Sign in
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm font-normal">
            Enter your email and password to access examinations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-normal text-zinc-300">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@school.edu"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border-zinc-800 bg-zinc-900/60 text-zinc-100 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-normal text-zinc-300">
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>

            <div className="text-center text-sm text-zinc-400 pt-2">
              Don&apos;t have an account?{" "}
              {onSwitchToSignUp ? (
                <button
                  type="button"
                  onClick={onSwitchToSignUp}
                  className="text-zinc-200 underline underline-offset-4 hover:text-white transition-colors font-medium"
                >
                  Create account
                </button>
              ) : (
                <Link
                  href="/auth/sign-up"
                  className="text-zinc-200 underline underline-offset-4 hover:text-white transition-colors font-medium"
                >
                  Create account
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
