"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle,CardDescription } from "@/components/ui/card";
import AppSidebar from "@/components/AppSidebar";

interface Test {
  id: string;
  title: string;
  duration_minutes: number;
}

export default function Dashboard() {
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadTests = async () => {
      const { data, error } = await supabase.from("tests").select("*");
      if (!error && data) {
        setTests(data);
      }
      setIsLoading(false);
    };
    loadTests();
  }, [supabase]);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-black text-white font-bold tracking-widest uppercase text-sm animate-pulse">Loading Portal...</div>;

  return (
    <AppSidebar>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-zinc-800 pb-6 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Student Portal</h1>
          <p className="text-zinc-500 mt-2 text-xs uppercase tracking-widest font-semibold">
            Select an examination to begin
          </p>
        </header>

        {tests.length === 0 ? (
          <p className="text-zinc-500">No tests are currently available. Check back later.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test) => (
              <Card key={test.id} className="bg-zinc-950 border-zinc-800 rounded-none">
                <CardHeader>
                  <CardTitle className="text-xl">{test.title}</CardTitle>
                  <CardDescription className="text-zinc-500">Duration: {test.duration_minutes} mins</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/exam?testId=${test.id}`}>
                    <Button className="w-full h-12 rounded-none bg-white text-black hover:bg-zinc-200 font-bold tracking-wide">
                      START TEST
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </AppSidebar>
  );
}