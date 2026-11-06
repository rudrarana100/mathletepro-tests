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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-none border-zinc-800 bg-zinc-950 text-white shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Security Credentials</CardTitle>
          <CardDescription className="text-zinc-400 text-xs font-mono">
            Specify a new secure passphrase for your academic account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="password" className="font-mono text-xs uppercase text-zinc-300">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
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
                {isLoading ? "Updating Security Hash..." : "Save New Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
