import { redirect } from "next/navigation";

export default function ProtectedRoute() {
  // Instantly bounces you to the dashboard after login
  redirect("/dashboard");
}