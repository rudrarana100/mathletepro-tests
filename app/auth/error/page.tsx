import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 font-normal leading-relaxed">
        {params?.error ? `Error code: ${params.error}` : "An unspecified authentication error occurred."}
      </p>
      <Link href="/auth/login" className="block pt-2">
        <Button className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors">
          Return to sign in
        </Button>
      </Link>
    </div>
  );
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-black text-zinc-100 font-sans">
      <div className="w-full max-w-md">
        <Card className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <div className="w-10 h-10 rounded-lg bg-red-950/30 border border-red-500/20 flex items-center justify-center text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
              Authentication failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-sm text-zinc-500">Loading error details...</div>}>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
