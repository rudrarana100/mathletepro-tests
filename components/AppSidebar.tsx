"use client";

import StudentSidebar from "./StudentSidebar";

/**
 * Legacy AppSidebar alias forwarding to StudentSidebar
 */
export default function AppSidebar({ children }: { children: React.ReactNode }) {
  return <StudentSidebar>{children}</StudentSidebar>;
}