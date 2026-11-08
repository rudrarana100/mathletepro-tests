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
        { error: "Authentication required to initiate examination." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { testId } = body;

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    // 1. Try atomic server RPC: start_exam_attempt
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "start_exam_attempt",
        { p_test_id: testId }
      );

      if (!rpcError && rpcData) {
        if (rpcData.alreadyCompleted) {
          return NextResponse.json(
            {
              error: "You have already completed and submitted this examination.",
              alreadyCompleted: true,
              resultId: rpcData.resultId,
              score: rpcData.score,
            },
            { status: 403 }
          );
        }

        return NextResponse.json(rpcData);
      }
    } catch {
      // Fall through to manual server verification if RPC is not installed
    }

    // 2. Fallback path: verify test and manage attempt in public.attempts
    const { data: testData, error: testError } = await supabase
      .from("tests")
      .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time")
      .eq("id", testId)
      .maybeSingle();

    if (testError || !testData) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 }
      );
    }

    if (testData.is_published === false) {
      return NextResponse.json(
        { error: "This examination is currently a draft and has not been published." },
        { status: 403 }
      );
    }

    // Check scheduling window
    const now = new Date();
    if (testData.start_time && now < new Date(testData.start_time)) {
      return NextResponse.json(
        { error: "This examination has not opened yet." },
        { status: 403 }
      );
    }
    if (testData.end_time && now > new Date(testData.end_time)) {
      return NextResponse.json(
        { error: "The examination window has closed." },
        { status: 403 }
      );
    }

    // Check for existing completion in test_results
    const { data: existingResult } = await supabase
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

    const durationMinutes = testData.duration_minutes || 60;
    const nowIso = now.toISOString();

    // Fetch or create attempt in public.attempts
    let attemptStartTime = nowIso;
    let attemptEndTime = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();
    let currentStrikes = 0;
    let remainingSeconds = durationMinutes * 60;

    const { data: existingAttempt } = await supabase
      .from("attempts")
      .select("id, status, started_at, end_time, strikes, result_id")
      .eq("user_id", user.id)
      .eq("test_id", testId)
      .maybeSingle();

    if (existingAttempt) {
      if (existingAttempt.status === "completed" && existingAttempt.result_id) {
        return NextResponse.json(
          {
            error: "You have already completed and submitted this examination.",
            alreadyCompleted: true,
            resultId: existingAttempt.result_id,
          },
          { status: 403 }
        );
      }

      attemptStartTime = existingAttempt.started_at;
      currentStrikes = existingAttempt.strikes || 0;

      if (existingAttempt.end_time) {
        attemptEndTime = existingAttempt.end_time;
        const diffSec = Math.floor((new Date(existingAttempt.end_time).getTime() - Date.now()) / 1000);
        remainingSeconds = Math.max(0, diffSec);
      } else {
        // Backfill end_time
        attemptEndTime = new Date(new Date(existingAttempt.started_at).getTime() + durationMinutes * 60 * 1000).toISOString();
        const diffSec = Math.floor((new Date(attemptEndTime).getTime() - Date.now()) / 1000);
        remainingSeconds = Math.max(0, diffSec);
        await supabase
          .from("attempts")
          .update({ end_time: attemptEndTime })
          .eq("id", existingAttempt.id);
      }
    } else {
      // Create new in-progress attempt
      await supabase.from("attempts").insert({
        user_id: user.id,
        test_id: testId,
        status: "in_progress",
        started_at: attemptStartTime,
        end_time: attemptEndTime,
        strikes: 0,
      });
    }

    // Fetch questions strictly without answers/solutions (safe student_questions view)
    let questions = null;
    const { data: viewQuestions, error: viewError } = await supabase
      .from("student_questions")
      .select("id, statement, options, image_url, topic, difficulty")
      .eq("test_id", testId)
      .order("created_at", { ascending: true });

    if (!viewError && viewQuestions !== null) {
      questions = viewQuestions;
    } else {
      const { data: tableQuestions, error: tableError } = await supabase
        .from("questions")
        .select("id, statement, options, image_url, topic, difficulty")
        .eq("test_id", testId)
        .order("created_at", { ascending: true });

      if (tableError) {
        return NextResponse.json(
          { error: "Failed to retrieve examination questions." },
          { status: 500 }
        );
      }
      questions = tableQuestions;
    }

    return NextResponse.json({
      success: true,
      test: {
        id: testData.id,
        title: testData.title,
        duration_minutes: durationMinutes,
        positive_marks: testData.positive_marks ?? 4,
        negative_marks: testData.negative_marks ?? 1,
      },
      questions: questions || [],
      remainingSeconds,
      startedAt: attemptStartTime,
      endTime: attemptEndTime,
      strikes: currentStrikes,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
