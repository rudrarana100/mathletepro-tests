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

    // Fetch test details from live Supabase
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

    // Check for existing attempt in test_results
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
    const totalAllowedSeconds = durationMinutes * 60;

    // Fetch questions strictly without correct answers/solutions for test integrity
    // Uses the safe student_questions view (omits correct_option_index and solution)
    let questions = null;
    const { data: viewQuestions, error: viewError } = await supabase
      .from("student_questions")
      .select("id, statement, options, image_url")
      .eq("test_id", testId)
      .order("created_at", { ascending: true });

    if (!viewError && viewQuestions !== null) {
      questions = viewQuestions;
    } else {
      // Fallback to questions table if student_questions view is not yet migrated
      const { data: tableQuestions, error: tableError } = await supabase
        .from("questions")
        .select("id, statement, options, image_url")
        .eq("test_id", testId)
        .order("created_at", { ascending: true });

      if (tableError) {
        return NextResponse.json(
          { error: "Failed to retrieve examination inquiries." },
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
      remainingSeconds: totalAllowedSeconds,
      startedAt: new Date().toISOString(),
      strikes: 0,
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
