import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_TESTS, DEMO_QUESTIONS } from "@/lib/demo-data";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("mathlete_demo_user")?.value;
    let user: { id: string; email?: string } | null = null;

    if (demoCookie) {
      try {
        user = JSON.parse(demoCookie);
      } catch {
        user = null;
      }
    }

    const supabase = await createClient();

    if (!user) {
      try {
        const {
          data: { user: supabaseUser },
        } = await supabase.auth.getUser();
        if (supabaseUser) user = supabaseUser;
      } catch {
        // Supabase offline, fallback to guest student
        user = { id: "demo-student-id", email: "student@mathletepro.com" };
      }
    }

    if (!user) {
      user = { id: "demo-student-id", email: "student@mathletepro.com" };
    }

    const body = await req.json();
    const { testId } = body;

    if (!testId) {
      return NextResponse.json(
        { error: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    // 1. Check if testId matches our built-in high-quality demo tests
    const demoTest = DEMO_TESTS.find((t) => t.id === testId);
    if (demoTest) {
      const demoQuestions = DEMO_QUESTIONS[testId] || [];
      // Clean questions without answers/solutions for test integrity
      const sanitizedQuestions = demoQuestions.map((q) => ({
        id: q.id,
        statement: q.statement,
        options: JSON.stringify(q.options),
        image_url: q.image_url,
      }));

      return NextResponse.json({
        success: true,
        test: {
          id: demoTest.id,
          title: demoTest.title,
          duration_minutes: demoTest.duration_minutes,
          positive_marks: demoTest.positive_marks,
          negative_marks: demoTest.negative_marks,
        },
        questions: sanitizedQuestions,
        remainingSeconds: demoTest.duration_minutes * 60,
        startedAt: new Date().toISOString(),
        strikes: 0,
      });
    }

    // 2. Otherwise fetch test details from live Supabase
    try {
      const { data: testData, error: testError } = await supabase
        .from("tests")
        .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time")
        .eq("id", testId)
        .maybeSingle();

      if (testError || !testData) {
        // Fallback to first demo test if test not found
        const fallback = DEMO_TESTS[0];
        const questions = (DEMO_QUESTIONS[fallback.id] || []).map((q) => ({
          id: q.id,
          statement: q.statement,
          options: JSON.stringify(q.options),
          image_url: q.image_url,
        }));
        return NextResponse.json({
          success: true,
          test: {
            id: fallback.id,
            title: fallback.title,
            duration_minutes: fallback.duration_minutes,
            positive_marks: fallback.positive_marks,
            negative_marks: fallback.negative_marks,
          },
          questions,
          remainingSeconds: fallback.duration_minutes * 60,
          startedAt: new Date().toISOString(),
          strikes: 0,
        });
      }

      // Check for existing attempt
      let currentAttempt = {
        started_at: new Date().toISOString(),
        strikes: 0,
        status: "in_progress",
      };

      const { data: existingAttempt } = await supabase
        .from("attempts")
        .select("*")
        .eq("user_id", user.id)
        .eq("test_id", testId)
        .maybeSingle();

      if (existingAttempt) {
        if (existingAttempt.status === "completed") {
          return NextResponse.json(
            {
              error: "You have already completed this examination.",
              alreadyCompleted: true,
              resultId: existingAttempt.result_id,
            },
            { status: 403 }
          );
        }
        currentAttempt = existingAttempt;
      }

      const durationMinutes = testData.duration_minutes || 60;
      const totalAllowedSeconds = durationMinutes * 60;
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(currentAttempt.started_at).getTime()) / 1000
      );
      const remainingSeconds = Math.max(0, totalAllowedSeconds - elapsedSeconds);

      // Fetch questions strictly without correct answers/solutions
      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("id, statement, options, image_url")
        .eq("test_id", testId);

      if (questionsError) {
        throw new Error(questionsError.message);
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
        startedAt: currentAttempt.started_at,
        strikes: currentAttempt.strikes ?? 0,
      });
    } catch {
      // In case database connection fails, fall back to first demo test
      const fallback = DEMO_TESTS[0];
      const questions = (DEMO_QUESTIONS[fallback.id] || []).map((q) => ({
        id: q.id,
        statement: q.statement,
        options: JSON.stringify(q.options),
        image_url: q.image_url,
      }));
      return NextResponse.json({
        success: true,
        test: {
          id: fallback.id,
          title: fallback.title,
          duration_minutes: fallback.duration_minutes,
          positive_marks: fallback.positive_marks,
          negative_marks: fallback.negative_marks,
        },
        questions,
        remainingSeconds: fallback.duration_minutes * 60,
        startedAt: new Date().toISOString(),
        strikes: 0,
      });
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
