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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  onSwitchToLogin,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  onSwitchToLogin?: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/student/tests`,
        },
      });
      if (error) throw error;

      if (data.session) {
        // Auto-confirmed signup
        router.push("/student/tests");
      } else {
        // Confirmation email dispatched
        router.push("/auth/sign-up-success");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred during registration.";
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
            <Image
              src="/logo.png"
              alt="Mathlete Pro"
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-contain shrink-0"
              priority
            />
            <span className="text-sm font-semibold tracking-tight text-zinc-200">
              Mathlete Pro
            </span>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
            Create account
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm font-normal">
            Register your student account to take examinations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-normal text-zinc-300">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Alex Morgan"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-md border-zinc-800 bg-zinc-900/60 text-zinc-100 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 h-10"
              />
            </div>
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
              <Label htmlFor="password" className="text-sm font-normal text-zinc-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border-zinc-800 bg-zinc-900/60 text-zinc-100 text-sm placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repeatPassword" className="text-sm font-normal text-zinc-300">
                Confirm password
              </Label>
              <Input
                id="repeatPassword"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
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
              {isLoading ? "Creating account..." : "Create account"}
            </Button>

            <div className="text-center text-sm text-zinc-400 pt-2">
              Already have an account?{" "}
              {onSwitchToLogin ? (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-zinc-200 underline underline-offset-4 hover:text-white transition-colors font-medium"
                >
                  Sign in
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-zinc-200 underline underline-offset-4 hover:text-white transition-colors font-medium"
                >
                  Sign in
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
