import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import StudentProfileView, {
  StudentProfileData,
} from "@/components/StudentProfileView";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const { user, profile: userProfile } = await requireUser();
  const supabase = await createClient();

  const { data: results } = await supabase
    .from("test_results")
    .select("score, tests(positive_marks, questions(id))")
    .eq("student_id", user.id);

  const rawResults: any[] = results ?? [];
  const count = rawResults.length;
  const totalScore: number = rawResults.reduce((acc: number, r: any) => acc + (r.score || 0), 0);
  const totalMaxMarks: number = rawResults.reduce((acc: number, r: any) => {
    const testObj = Array.isArray(r.tests) ? r.tests[0] : r.tests;
    const qCount = testObj?.questions?.length ?? 0;
    const pos = testObj?.positive_marks ?? 4;
    return acc + (qCount * pos);
  }, 0);

  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  const avgMax = count > 0 ? Math.round(totalMaxMarks / count) : 0;
  const avgPct = avgMax > 0 ? Math.round((avgScore / avgMax) * 100) : 0;
  const formattedAvg = count > 0 && avgMax > 0
    ? `${avgScore} / ${avgMax} (${avgPct}%)`
    : `${avgScore} pts`;

  const profileData: StudentProfileData = {
    id: user.id,
    email: user.email,
    full_name: userProfile.full_name || user.email.split("@")[0] || "Student",
    role: userProfile.role,
    created_at: userProfile.created_at || new Date().toISOString(),
    testsCompletedCount: count,
    averageScore: avgScore,
    formattedAvgScore: formattedAvg,
  };

  return <StudentProfileView profile={profileData} />;
}
