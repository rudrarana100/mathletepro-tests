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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Clear any prior demo cookie to use live Supabase session
      document.cookie = "mathlete_demo_user=; path=/; max-age=0";
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred";
      if (msg.includes("Failed to fetch") || msg.includes("fetch failed")) {
        setError(
          "Cloud database connection timeout. You can use the 1-Click Evaluation Access below to explore Mathlete Pro immediately in Sandbox mode."
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (role: "student" | "admin") => {
    const userPayload =
      role === "admin"
        ? { id: "demo-admin-id", email: "admin@mathletepro.com", role: "admin" }
        : { id: "demo-student-id", email: "student@mathletepro.com", role: "student" };

    document.cookie = `mathlete_demo_user=${encodeURIComponent(
      JSON.stringify(userPayload)
    )}; path=/; max-age=86400; SameSite=Lax`;

    if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
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
            Sign in with registered academic credentials or test-drive via Sandbox
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

          {/* Quick Sandbox / Evaluation Access */}
          <div className="mt-6 pt-5 border-t border-zinc-900 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
              <span>Instant Sandbox Evaluation</span>
              <span className="text-emerald-400 font-bold">1-Click</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("student")}
                className="py-2.5 px-3 border border-zinc-800 bg-black hover:border-zinc-600 hover:bg-zinc-900 text-left transition-colors rounded-none"
              >
                <div className="font-mono text-xs font-bold text-white uppercase">Demo Student</div>
                <div className="font-mono text-[10px] text-zinc-500 truncate">Test examination flow</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("admin")}
                className="py-2.5 px-3 border border-zinc-800 bg-black hover:border-zinc-600 hover:bg-zinc-900 text-left transition-colors rounded-none"
              >
                <div className="font-mono text-xs font-bold text-white uppercase">Demo Faculty</div>
                <div className="font-mono text-[10px] text-zinc-500 truncate">Admin studio & bank</div>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs font-mono text-zinc-500">
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
