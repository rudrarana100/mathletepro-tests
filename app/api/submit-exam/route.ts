import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { testId, userId, answers } = await req.json();

    if (!testId) {
      return NextResponse.json({ error: "Missing testId in submission" }, { status: 400 });
    }

    // 1. Get test marking scheme
    const { data: testData } = await supabase.from("tests").select("positive_marks, negative_marks").eq("id", testId).single();
    
    const pos = testData?.positive_marks ?? 4;
    const neg = testData?.negative_marks ?? 1;

    // 2. Fetch the correct answers
    const { data: questions, error: qError } = await supabase.from("questions").select("id, correct_option_index").eq("test_id", testId);
    if (qError) throw new Error("Failed to fetch questions: " + qError.message);

    let score = 0;
    let correct = 0;
    const attempted = answers ? Object.keys(answers).length : 0;

    // 3. Grade the exam
    questions?.forEach((q) => {
      if (answers && answers[q.id] !== undefined) {
        if (answers[q.id] === q.correct_option_index) {
          score += pos;
          correct += 1;
        } else {
          score -= neg; 
        }
      }
    });

    // 4. Save to database
    const insertPayload: any = {
      test_id: testId,
      score,
      total_attempted: attempted,
      total_correct: correct,
      answers_data: answers || {}
    };

    if (userId) {
      insertPayload.student_id = userId;
    }

    const { data: result, error: insertError } = await supabase
      .from("test_results")
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) throw new Error("Database insert failed: " + insertError.message);
    
    return NextResponse.json({ resultId: result.id });
    
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown server error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}