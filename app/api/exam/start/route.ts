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
    const { testId, action = "init" } = body;

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    // Admins must never be able to start or submit an exam
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return NextResponse.json(
        { error: "Faculty accounts cannot take or start examinations." },
        { status: 403 }
      );
    }

    // 1. Try atomic server RPC: start_exam_attempt (SECURITY DEFINER)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "start_exam_attempt",
        { p_test_id: testId, p_action: action }
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

        // Section B.1: Tests with 0 questions must not be startable
        const rpcQuestions = rpcData.questions || [];
        if (rpcQuestions.length === 0) {
          return NextResponse.json(
            { error: "This examination has 0 questions and cannot be started." },
            { status: 400 }
          );
        }

        return NextResponse.json(rpcData);
      }
    } catch {
      // Fall through to manual server verification if RPC is not installed
    }

    // 2. Fallback path: verify test and manage attempt in public.attempts
    // Check question count via student_questions or questions
    const { count: sqCount } = await supabase
      .from("student_questions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId);

    const questionCount =
      sqCount ??
      (
        await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("test_id", testId)
      ).count;

    if ((questionCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "This examination has 0 questions and cannot be started." },
        { status: 400 }
      );
    }

    const { data: testData, error: testError } = await supabase
      .from("tests")
      .select("id, title, duration_minutes, positive_marks, negative_marks, max_strikes, is_published, start_time, end_time")
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

    const testMeta = {
      id: testData.id,
      title: testData.title,
      duration_minutes: durationMinutes,
      positive_marks: testData.positive_marks ?? 4,
      negative_marks: testData.negative_marks ?? 1,
      max_strikes: testData.max_strikes ?? 3,
    };

    // Check for existing attempt in public.attempts
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

      let attemptEndTime = existingAttempt.end_time;
      let remainingSeconds = durationMinutes * 60;

      if (existingAttempt.end_time) {
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

      return NextResponse.json({
        success: true,
        hasActiveAttempt: true,
        test: testMeta,
        questions: questions || [],
        remainingSeconds,
        serverNow: nowIso,
        startedAt: existingAttempt.started_at,
        endTime: attemptEndTime,
        strikes: existingAttempt.strikes || 0,
      });
    }

    // No existing attempt found.
    // If action is "init", do NOT create attempt yet. Return data for instructions screen.
    if (action === "init") {
      return NextResponse.json({
        success: true,
        hasActiveAttempt: false,
        test: testMeta,
        questions: questions || [],
        remainingSeconds: durationMinutes * 60,
        serverNow: nowIso,
        strikes: 0,
      });
    }

    // action is "begin": create new in-progress attempt now
    const attemptStartTime = nowIso;
    const attemptEndTime = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

    await supabase.from("attempts").insert({
      user_id: user.id,
      test_id: testId,
      status: "in_progress",
      started_at: attemptStartTime,
      end_time: attemptEndTime,
      strikes: 0,
    });

    return NextResponse.json({
      success: true,
      hasActiveAttempt: true,
      test: testMeta,
      questions: questions || [],
      remainingSeconds: durationMinutes * 60,
      serverNow: nowIso,
      startedAt: attemptStartTime,
      endTime: attemptEndTime,
      strikes: 0,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
