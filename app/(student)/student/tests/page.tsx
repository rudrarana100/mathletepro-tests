import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import StudentTestsView, {
  StudentTestItem,
  StudentResultItem,
  StudentAttemptItem,
} from "@/components/StudentTestsView";

export const dynamic = "force-dynamic";

export default async function StudentTestsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  // Parallel server fetch via Promise.all
  const [testsRes, attemptsRes, activeAttemptsRes, studentQuestionsRes] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time, questions(id)")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("test_results")
      .select("id, test_id, score, total_attempted, total_correct, created_at, tests(title, positive_marks, questions(id))")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attempts")
      .select("id, test_id, status, end_time")
      .eq("user_id", user.id)
      .eq("status", "in_progress"),
    supabase
      .from("student_questions")
      .select("id, test_id"),
  ]);

  const rawTests = (testsRes.data ?? []) as unknown as StudentTestItem[];
  const studentQuestions = (studentQuestionsRes.data ?? []) as { id: string; test_id: string }[];

  // Count questions by test_id from student_questions view as a resilient fallback
  const sqCountByTest = new Map<string, number>();
  studentQuestions.forEach((sq) => {
    if (sq.test_id) {
      sqCountByTest.set(sq.test_id, (sqCountByTest.get(sq.test_id) ?? 0) + 1);
    }
  });

  const tests = rawTests.map((t) => {
    const directCount = t.questions?.length ?? 0;
    if (directCount === 0 && sqCountByTest.has(t.id)) {
      const fallbackCount = sqCountByTest.get(t.id) ?? 0;
      return {
        ...t,
        questions: Array.from({ length: fallbackCount }, (_, i) => ({ id: `sq-${i}` })),
      };
    }
    return t;
  });

  const myAttempts = (attemptsRes.data ?? []) as unknown as StudentResultItem[];
  const activeAttempts = (activeAttemptsRes.data ?? []) as unknown as StudentAttemptItem[];

  return (
    <StudentTestsView
      tests={tests}
      myAttempts={myAttempts}
      activeAttempts={activeAttempts}
    />
  );
}
