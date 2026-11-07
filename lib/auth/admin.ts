import { createClient } from "@/lib/supabase/server";

export interface AdminVerificationResult {
  isAdmin: boolean;
  user: {
    id: string;
    email?: string;
  } | null;
  error?: string;
}

/**
 * Server-side helper to check if the current user has the 'admin' role in public.profiles.
 * Never checks hardcoded emails and never uses demo cookies.
 */
export async function checkAdminRole(): Promise<AdminVerificationResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { isAdmin: false, user: null, error: "Not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return {
        isAdmin: false,
        user: { id: user.id, email: user.email },
        error: "Forbidden: Admin role required",
      };
    }

    return {
      isAdmin: true,
      user: { id: user.id, email: user.email },
    };
  } catch (err) {
    return {
      isAdmin: false,
      user: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Server-side assertion that throws an error if user is not an admin.
 */
export async function requireAdmin() {
  const result = await checkAdminRole();
  if (!result.isAdmin) {
    throw new Error(result.error || "Access Denied: Admin privileges required");
  }
  return result;
}
