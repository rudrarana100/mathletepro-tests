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
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
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
        // Fetch role to determine redirect
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
      const msg = error instanceof Error ? error.message : "An error occurred";
      setError(msg);
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
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Platform Access</CardTitle>
          <CardDescription className="text-zinc-400 text-xs font-mono">
            Sign in with your registered academic credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-mono text-xs uppercase text-zinc-300">
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="font-mono text-[11px] text-zinc-400 hover:text-white underline underline-offset-4"
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
                {isLoading ? "Authenticating..." : "Authorize Sign In"}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-900 text-center text-xs font-mono text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/sign-up"
              className="text-zinc-300 hover:text-white underline underline-offset-4"
            >
              Register here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
