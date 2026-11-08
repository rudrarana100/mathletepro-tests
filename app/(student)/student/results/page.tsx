import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import StudentResultsView, {
  StudentResultRow,
} from "@/components/StudentResultsView";

export const dynamic = "force-dynamic";

export default async function StudentResultsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("test_results")
    .select(
      "id, test_id, score, total_attempted, total_correct, created_at, tests(title, duration_minutes, positive_marks, questions(id))"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const rawResults = data ?? [];
  const testIds = Array.from(new Set(rawResults.map((r) => r.test_id).filter(Boolean)));

  const cohortMap = new Map<string, { rank: number; total: number }>();
  if (testIds.length > 0) {
    const { data: allScores } = await supabase
      .from("test_results")
      .select("test_id, score, student_id")
      .in("test_id", testIds);

    if (allScores) {
      testIds.forEach((tId) => {
        const testCohort = allScores.filter((s) => s.test_id === tId);
        const myScoreObj = testCohort.find((s) => s.student_id === user.id);
        if (myScoreObj) {
          const rank = testCohort.filter((s) => s.score > myScoreObj.score).length + 1;
          cohortMap.set(tId, { rank, total: testCohort.length });
        }
      });
    }
  }

  const initialAttempts = rawResults.map((r) => {
    const cohort = cohortMap.get(r.test_id);
    return {
      ...r,
      rank: cohort ? cohort.rank : 1,
      totalCohort: cohort ? cohort.total : 1,
    };
  }) as unknown as StudentResultRow[];

  return <StudentResultsView initialAttempts={initialAttempts} />;
}
