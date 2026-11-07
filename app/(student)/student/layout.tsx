import { Suspense } from "react";
import { requireUser } from "@/lib/auth/guards";
import StudentSidebar from "@/components/StudentSidebar";

async function StudentGuard({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <StudentSidebar>{children}</StudentSidebar>;
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-xs uppercase tracking-widest">
          Authorizing Student Credentials...
        </div>
      }
    >
      <StudentGuard>{children}</StudentGuard>
    </Suspense>
  );
}
