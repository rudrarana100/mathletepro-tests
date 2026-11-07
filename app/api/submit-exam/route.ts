import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { testId, answers } = await req.json();

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    const studentAnswers = answers || {};

    // 1. Attempt atomic server-side grading via Postgres RPC (grade_and_submit_exam)
    // This executes atomically inside Postgres with SECURITY DEFINER privileges.
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "grade_and_submit_exam",
        {
          p_test_id: testId,
          p_answers: studentAnswers,
        }
      );

      if (!rpcError && rpcResult) {
        return NextResponse.json({
          success: true,
          resultId: rpcResult.id,
          score: rpcResult.score,
          totalAttempted: rpcResult.total_attempted,
          totalCorrect: rpcResult.total_correct,
        });
      }

      // If the RPC raised a custom validation exception, return it directly
      if (rpcError && rpcError.message && !rpcError.message.includes("function") && !rpcError.message.includes("does not exist")) {
        return NextResponse.json(
          { error: rpcError.message },
          { status: 403 }
        );
      }
    } catch {
      // Fall through to standard grading if RPC is not available in current database
    }

    // 2. Fallback: Manual server grading in Next.js
    // Fetch test marking scheme from live database
    const { data: testData, error: testError } = await supabase
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

    // Fetch correct answers securely from the backend
    const { data: questions, error: qError } = await supabase
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

    // Save scorecard to test_results table
    const insertPayload = {
      test_id: testId,
      student_id: user.id,
      score,
      total_attempted: attempted,
      total_correct: correct,
      answers: studentAnswers,
    };

    const { data: result, error: insertError } = await supabase
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

    // Update attempt record if exists
    try {
      const nowIso = new Date().toISOString();
      await supabase
        .from("attempts")
        .update({
          status: "completed",
          submitted_at: nowIso,
          result_id: result.id,
        })
        .eq("user_id", user.id)
        .eq("test_id", testId);
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