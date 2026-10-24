import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface QuestionRecord {
  id: string;
  correct_option_index: number;
  test_id?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { testId, answers = {} } = body as {
      testId?: string | null;
      answers?: Record<string | number, string | number>;
    };

    const supabase = await createClient();

    // Authenticate user to capture student_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Securely retrieve questions and correct answers from the backend
    let questions: QuestionRecord[] = [];

    if (testId) {
      const { data: testQuestions, error: testQError } = await supabase
        .from("questions")
        .select("id, correct_option_index, test_id")
        .eq("test_id", testId);

      if (testQError) {
        console.error("Error fetching test questions by test_id:", testQError);
      }

      if (testQuestions && testQuestions.length > 0) {
        questions = testQuestions as QuestionRecord[];
      }
    }

    // Fallback: if no questions found with test_id (or testId not specified), fetch all questions
    if (questions.length === 0) {
      const { data: allQuestions, error: allQError } = await supabase
        .from("questions")
        .select("id, correct_option_index, test_id");

      if (allQError || !allQuestions) {
        console.error("Error fetching fallback questions:", allQError);
        return NextResponse.json(
          { error: "Failed to fetch validation questions from database" },
          { status: 500 }
        );
      }
      questions = allQuestions as QuestionRecord[];
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No exam questions found to evaluate" },
        { status: 404 }
      );
    }

    // Calculate score: +4 for correct, -1 for incorrect, 0 for unattempted
    let score = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalAttempted = 0;

    questions.forEach((q, index) => {
      // Check answers keyed by index, numeric string index, or question UUID
      const studentAnswer =
        answers[index] ?? answers[String(index)] ?? answers[q.id];

      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== "") {
        totalAttempted++;
        const parsedOption = parseInt(String(studentAnswer), 10);

        if (parsedOption === q.correct_option_index) {
          score += 4;
          totalCorrect++;
        } else {
          score -= 1;
          totalIncorrect++;
        }
      }
    });

    // Save final result to test_results table
    const resultPayload = {
      student_id: user?.id ?? null,
      test_id: testId || null,
      score,
      total_attempted: totalAttempted,
      total_correct: totalCorrect,
      answers: answers || {},
    };

    const { data: insertedResult, error: insertError } = await supabase
      .from("test_results")
      .insert(resultPayload)
      .select("id")
      .single();

    if (insertError) {
      console.error("Database insert error on test_results:", insertError);
      return NextResponse.json(
        {
          error: "Failed to persist test result to database",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      resultId: insertedResult.id,
      score,
      totalAttempted,
      totalCorrect,
      totalIncorrect,
      totalQuestions: questions.length,
    });
  } catch (err) {
    console.error("Unexpected error in /api/submit-exam:", err);
    return NextResponse.json(
      { error: "Internal server error during exam submission" },
      { status: 500 }
    );
  }
}
