import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required to submit examination." },
        { status: 401 }
      );
    }

    const { testId, answers, reason } = await req.json();

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    // Section B.2: Admins must never be able to submit an exam
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return NextResponse.json(
        { error: "Faculty accounts cannot take or submit examinations." },
        { status: 403 }
      );
    }

    const studentAnswers = answers || {};
    const submissionReason = reason || "student_submitted";

    // 1. Primary: Atomic server-side grading via Postgres RPC (grade_and_submit_exam)
    // Runs inside Postgres with SECURITY DEFINER privileges.
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "grade_and_submit_exam",
        {
          p_test_id: testId,
          p_answers: studentAnswers,
          p_reason: submissionReason,
        }
      );

      if (!rpcError && rpcResult) {
        return NextResponse.json({
          success: true,
          resultId: rpcResult.id,
          score: rpcResult.score,
          totalAttempted: rpcResult.total_attempted,
          totalCorrect: rpcResult.total_correct,
          reason: submissionReason,
        });
      }

      // If the RPC returned a validation error (e.g. already submitted), surface it
      if (
        rpcError &&
        rpcError.message &&
        !rpcError.message.includes("function") &&
        !rpcError.message.includes("does not exist")
      ) {
        return NextResponse.json(
          { error: rpcError.message },
          { status: 403 }
        );
      }
    } catch {
      // Fall through to admin client fallback if RPC is unavailable
    }

    // 2. Fallback: Secure server grading using service-role admin client
    const adminSupabase = createAdminClient();

    // Check if user already submitted
    const { data: existingResult } = await adminSupabase
      .from("test_results")
      .select("id")
      .eq("student_id", user.id)
      .eq("test_id", testId)
      .maybeSingle();

    if (existingResult) {
      return NextResponse.json(
        {
          error: "You have already completed and submitted this examination.",
          alreadyCompleted: true,
          resultId: existingResult.id,
        },
        { status: 403 }
      );
    }

    const { data: testData, error: testError } = await adminSupabase
      .from("tests")
      .select("id, duration_minutes, positive_marks, negative_marks")
      .eq("id", testId)
      .maybeSingle();

    if (testError || !testData) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 }
      );
    }

    const pos = testData.positive_marks ?? 4;
    const neg = testData.negative_marks ?? 1;

    // Fetch answer key using service-role client (secure on server)
    const { data: questions, error: qError } = await adminSupabase
      .from("questions")
      .select("id, correct_option_index")
      .eq("test_id", testId);

    if (qError || !questions) {
      return NextResponse.json(
        { error: "Failed to fetch answer key for grading." },
        { status: 500 }
      );
    }

    let score = 0;
    let correct = 0;
    let attempted = 0;

    questions.forEach((q) => {
      const studentVal = studentAnswers[q.id];
      if (studentVal !== undefined && studentVal !== null && studentVal !== "") {
        attempted += 1;
        const parsedOpt = parseInt(String(studentVal), 10);
        if (parsedOpt === q.correct_option_index) {
          score += pos;
          correct += 1;
        } else {
          score -= neg;
        }
      }
    });

    const nowIso = new Date().toISOString();
    const insertPayload = {
      test_id: testId,
      student_id: user.id,
      score,
      total_attempted: attempted,
      total_correct: correct,
      answers: studentAnswers,
      submission_reason: submissionReason,
      created_at: nowIso,
    };

    const { data: result, error: insertError } = await adminSupabase
      .from("test_results")
      .insert([insertPayload])
      .select("id, score, total_attempted, total_correct")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to record examination scorecard: " + insertError.message },
        { status: 500 }
      );
    }

    // Update attempts record
    try {
      await adminSupabase
        .from("attempts")
        .upsert(
          {
            user_id: user.id,
            test_id: testId,
            status: "completed",
            submitted_at: nowIso,
            result_id: result.id,
            submission_reason: submissionReason,
          },
          { onConflict: "user_id,test_id" }
        );
    } catch {
      // attempts table is auxiliary
    }

    return NextResponse.json({
      success: true,
      resultId: result.id,
      score,
      totalAttempted: attempted,
      totalCorrect: correct,
    });
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown server error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}