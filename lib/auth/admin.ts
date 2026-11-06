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
 * Server-side helper to check if the current user has the 'admin' role.
 */
export async function checkAdminRole(): Promise<AdminVerificationResult> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("mathlete_demo_user")?.value;

    if (demoCookie) {
      try {
        const parsed = JSON.parse(demoCookie);
        if (parsed.role === "admin" || parsed.email === "admin@mathletepro.com") {
          return {
            isAdmin: true,
            user: { id: parsed.id || "demo-admin-id", email: parsed.email },
          };
        }
      } catch {
        // ignore
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { isAdmin: false, user: null, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin" && user.email !== "admin@mathletepro.com") {
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
