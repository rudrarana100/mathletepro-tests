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
        <div className="flex h-screen items-center justify-center bg-black text-zinc-400 text-sm font-normal">
          Verifying faculty credentials...
        </div>
      }
    >
      <AdminGuard>{children}</AdminGuard>
    </Suspense>
  );
}
