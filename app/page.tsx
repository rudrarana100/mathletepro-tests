import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthGateway } from "@/components/AuthGateway";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      redirect("/admin");
    } else {
      redirect("/student/tests");
    }
  }

  return <AuthGateway />;
}