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
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
              Check your email
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm font-normal">
              Password reset link has been dispatched to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-300">
              If an account exists for this academic email, you will receive password reset instructions shortly.
            </p>
            <div className="mt-6">
              <Link href="/auth/login">
                <Button className="w-full h-10 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors">
                  Return to sign in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
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
              Reset password
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm font-normal">
              Enter your email to receive recovery instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
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
                {isLoading ? "Sending link..." : "Send reset link"}
              </Button>

              <div className="text-center text-sm text-zinc-400 pt-2">
                Remember your password?{" "}
                <Link
                  href="/auth/login"
                  className="text-zinc-200 underline underline-offset-4 hover:text-white transition-colors font-medium"
                >
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
