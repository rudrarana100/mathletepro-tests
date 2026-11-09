import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const resultId = searchParams.get("resultId");

    if (!resultId) {
      return NextResponse.json(
        { error: "Missing required parameter: resultId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Try calling database RPC if registered
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_test_result_ranking",
        { p_result_id: resultId }
      );

      if (!rpcError && rpcData && typeof rpcData === "object") {
        return NextResponse.json(rpcData);
      }
    } catch {
      // Fall through to server-side query fallback
    }

    // 2. Server-side computation in SQL / Postgres client
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : supabase;

    // Get the target test result
    const { data: currentResult, error: currError } = await adminSupabase
      .from("test_results")
      .select("id, test_id, score, student_id")
      .eq("id", resultId)
      .maybeSingle();

    if (currError || !currentResult) {
      return NextResponse.json(
        { available: false, error: "Result not found" },
        { status: 404 }
      );
    }

    // Fetch all test results for this test, joining profile role to exclude admins
    const { data: cohort, error: cohortError } = await adminSupabase
      .from("test_results")
      .select("id, score, student_id, profiles(role)")
      .eq("test_id", currentResult.test_id);

    if (cohortError || !cohort) {
      return NextResponse.json({ available: false });
    }

    // Filter strictly for student attempts (excluding admins)
    const studentAttempts = cohort.filter((row: any) => {
      const role = row.profiles?.role;
      return role !== "admin";
    });

    const totalAttempts = studentAttempts.length;

    // Require at least 5 submitted attempts to display rank and percentile
    if (totalAttempts < 5) {
      return NextResponse.json({
        available: false,
        total_attempts: totalAttempts,
      });
    }

    const myScore = currentResult.score;

    // Rank: 1 + number of students with a strictly higher score
    const higherCount = studentAttempts.filter((r) => r.score > myScore).length;
    const rank = higherCount + 1;

    // Percentile formula: (students with a lower score / total attempts) * 100, rounded
    const lowerCount = studentAttempts.filter((r) => r.score < myScore).length;
    const percentile = Math.round((lowerCount / totalAttempts) * 100);

    return NextResponse.json({
      available: true,
      rank,
      total_attempts: totalAttempts,
      percentile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ available: false, error: message }, { status: 500 });
  }
}
