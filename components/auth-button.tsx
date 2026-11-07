import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  let user: { email?: string } | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  return user ? (
    <div className="flex items-center gap-4">
      <span className="font-mono text-xs text-zinc-300">Signed in as {user.email}</span>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"} className="rounded-none font-mono text-xs uppercase">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"} className="rounded-none bg-white text-black font-mono text-xs uppercase">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
