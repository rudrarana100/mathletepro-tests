import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { testId, userId, answers } = await req.json();

    // 1. Get test marking scheme
    const { data: testData } = await supabase.from("tests").select("positive_marks, negative_marks").eq("id", testId).single();
    
    // CRITICAL: Using ?? instead of || so that "0" is accepted as a valid negative mark
    const pos = testData?.positive_marks ?? 4;
    const neg = testData?.negative_marks ?? 1;

    // 2. Fetch the correct answers
    const { data: questions } = await supabase.from("questions").select("id, correct_option_index").eq("test_id", testId);

    let score = 0;
    let correct = 0;
    const attempted = Object.keys(answers).length;

    // 3. Grade the exam using the custom marking scheme
    questions?.forEach((q) => {
      if (answers[q.id] !== undefined) {
        if (answers[q.id] === q.correct_option_index) {
          score += pos;
          correct += 1;
        } else {
          score -= neg; // If 'neg' is 0, score doesn't change
        }
      }
    });

    // 4. Save to database
    const { data: result, error } = await supabase.from("test_results").insert([
      { student_id: userId, test_id: testId, score, total_attempted: attempted, total_correct: correct, answers_data: answers }
    ]).select().single();

    if (error) throw error;
    return NextResponse.json({ resultId: result.id });
    
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}