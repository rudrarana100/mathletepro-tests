import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import AdminSidebar from "@/components/AdminSidebar";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminSidebar>{children}</AdminSidebar>;
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
