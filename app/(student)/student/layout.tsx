import { Suspense } from "react";
import { requireUser } from "@/lib/auth/guards";
import StudentSidebar from "@/components/StudentSidebar";

async function StudentGuard({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return <StudentSidebar userEmail={session.user.email}>{children}</StudentSidebar>;
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black text-zinc-400 text-sm font-normal">
          Loading student console...
        </div>
      }
    >
      <StudentGuard>{children}</StudentGuard>
    </Suspense>
  );
}
