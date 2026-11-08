import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-black text-zinc-100 font-sans">
      <div className="w-full max-w-md">
        <Card className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
              Registration successful
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm font-normal">
              Check your email to verify your student account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-300 font-normal leading-relaxed">
              We have dispatched a verification link to your email address. Please click the link in the message to activate your examination access.
            </p>
            <div className="pt-2">
              <Link href="/auth/login">
                <Button className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors">
                  Return to sign in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
