import { getCachedSession } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export default async function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Section B.2: Admins must never be able to navigate to /exam/... directly
  if (session.profile.role === "admin") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-zinc-800">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center text-lg font-semibold">
            403
          </div>
          <h1 className="text-lg font-semibold text-zinc-100">Access Forbidden</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Faculty and administrator accounts are strictly prohibited from taking or submitting student examinations.
          </p>
          <div className="pt-2">
            <a
              href="/admin"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded-md transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
