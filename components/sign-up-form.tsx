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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
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
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
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
      const msg = error instanceof Error ? error.message : "An error occurred";
      if (msg.includes("Failed to fetch") || msg.includes("fetch failed")) {
        setError(
          "Cloud database connection timeout. Please verify your internet connection and try again."
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-none border-zinc-800 bg-zinc-950 text-white shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-white text-black font-black text-xs flex items-center justify-center font-mono">
              M
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              Mathlete Pro
            </span>
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Create Account</CardTitle>
          <CardDescription className="text-zinc-400 text-xs font-mono">
            Register your student identity for competitive mock examinations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="font-mono text-xs uppercase text-zinc-300">
                  Academic Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@mathletepro.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-none border-zinc-800 bg-black text-white font-mono text-xs focus:border-zinc-600 h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="font-mono text-xs uppercase text-zinc-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-none border-zinc-800 bg-black text-white font-mono text-xs focus:border-zinc-600 h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password" className="font-mono text-xs uppercase text-zinc-300">
                  Confirm Password
                </Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="rounded-none border-zinc-800 bg-black text-white font-mono text-xs focus:border-zinc-600 h-10"
                />
              </div>
              {error && (
                <div className="p-3 border border-red-500/40 bg-red-950/20 text-red-400 text-xs font-mono leading-relaxed">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-11"
                disabled={isLoading}
              >
                {isLoading ? "Provisioning Student Profile..." : "Complete Registration"}
              </Button>
            </div>
            <div className="mt-5 text-center text-xs font-mono text-zinc-500">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-zinc-300 hover:text-white underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
