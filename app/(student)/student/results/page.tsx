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

  const initialAttempts = (data ?? []) as unknown as StudentResultRow[];

  return <StudentResultsView initialAttempts={initialAttempts} />;
}
