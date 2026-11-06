import { Suspense } from "react";
import { redirect } from "next/navigation";
import { checkAdminRole } from "@/lib/auth/admin";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, user } = await checkAdminRole();

  if (!user) {
    redirect("/auth/login");
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-xs uppercase tracking-widest">
          Verifying Faculty Credentials...
        </div>
      }
    >
      <AdminGuard>{children}</AdminGuard>
    </Suspense>
  );
}
