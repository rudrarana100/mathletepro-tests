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
    .select("score")
    .eq("student_id", user.id);

  const count = results?.length || 0;
  const avg =
    count > 0
      ? Math.round(results!.reduce((acc, r) => acc + (r.score || 0), 0) / count)
      : 0;

  const profileData: StudentProfileData = {
    id: user.id,
    email: user.email,
    full_name: userProfile.full_name || user.email.split("@")[0] || "Student",
    role: userProfile.role,
    created_at: userProfile.created_at || new Date().toISOString(),
    testsCompletedCount: count,
    averageScore: avg,
  };

  return <StudentProfileView profile={profileData} />;
}
