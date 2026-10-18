import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answers: Record<number, string> = body.answers;
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: questions, error } = await supabase.from('questions').select('correct_option_index');

    if (error || !questions) {
      return NextResponse.json({ error: 'Failed to fetch validation data' }, { status: 500 });
    }

    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    // Added inline typing for the 'q' variable
    questions.forEach((q: { correct_option_index: number }, index: number) => {
      const studentAnswer = answers[index];
      if (studentAnswer !== undefined) {
        if (parseInt(studentAnswer) === q.correct_option_index) {
          score += 4;
          correctCount++;
        } else {
          score -= 1;
          incorrectCount++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      score,
      correctCount,
      incorrectCount,
      totalAttempted: correctCount + incorrectCount,
      totalQuestions: questions.length
    });
  } catch (err) {
    // Log the error to clear the 'unused variable' warning
    console.error("Submission API Error:", err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}