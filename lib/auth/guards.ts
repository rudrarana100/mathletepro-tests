import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "student";
  full_name?: string | null;
  created_at?: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
}

/**
 * Asserts and reads session + role exactly ONCE per request lifecycle.
 * React cache() de-duplicates calls across layout, pages, and server components.
 */
export const getCachedSession = cache(async (): Promise<AuthSession | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    profile: {
      id: user.id,
      email: user.email,
      role: profile?.role === "admin" ? "admin" : "student",
      full_name: profile?.full_name ?? null,
      created_at: profile?.created_at,
    },
  };
});

/**
 * Asserts a valid authenticated Supabase session.
 * If not authenticated, immediately redirects to /auth/login.
 * Returns the authenticated user and their profile.
 */
export async function requireUser(): Promise<AuthSession> {
  const session = await getCachedSession();
  if (!session) {
    redirect("/auth/login");
  }
  return session;
}

/**
 * Asserts an authenticated session with role === 'admin'.
 * If not authenticated, redirects to /auth/login.
 * If logged in as student, redirects to /student/tests.
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireUser();

  if (session.profile.role !== "admin") {
    redirect("/student/tests");
  }

  return session;
}

/**
 * Asserts an authenticated student session for taking exams.
 * Admins are blocked from taking student exams.
 */
export async function requireStudent(): Promise<AuthSession> {
  const session = await requireUser();

  if (session.profile.role === "admin") {
    redirect("/admin");
  }

  return session;
}
