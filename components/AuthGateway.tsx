"use client";

import { useState } from "react";
import { LoginForm } from "@/components/login-form";
import { SignUpForm } from "@/components/sign-up-form";

export function AuthGateway({ initialTab = "login" }: { initialTab?: "login" | "signup" }) {
  const [tab, setTab] = useState<"login" | "signup">(initialTab);

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Minimal Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`py-2 text-center rounded-md transition-colors ${
              tab === "login"
                ? "bg-zinc-800/80 text-zinc-100"
                : "hover:text-zinc-200"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`py-2 text-center rounded-md transition-colors ${
              tab === "signup"
                ? "bg-zinc-800/80 text-zinc-100"
                : "hover:text-zinc-200"
            }`}
          >
            Create account
          </button>
        </div>

        {tab === "login" ? (
          <LoginForm onSwitchToSignUp={() => setTab("signup")} />
        ) : (
          <SignUpForm onSwitchToLogin={() => setTab("login")} />
        )}
      </div>
    </div>
  );
}
