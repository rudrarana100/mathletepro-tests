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
  const [testsRes, attemptsRes, activeAttemptsRes] = await Promise.all([
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
  ]);

  const tests = (testsRes.data ?? []) as unknown as StudentTestItem[];
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
