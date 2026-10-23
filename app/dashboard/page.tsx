"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// 1. Define the exact shape of your Test data
interface Test {
  id: string;
  title: string;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
}

export default function StudentDashboard() {
  const supabase = createClient();
  // 2. Replace 'any[]' with 'Test[]'
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTests(data as Test[]);
      }
      setIsLoading(false);
    };

    fetchTests();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-8 font-sans flex justify-center">
      <div className="w-full max-w-5xl space-y-12 mt-10">
        
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-4xl font-bold tracking-tight">Student Portal</h1>
          <p className="text-zinc-500 mt-2 text-xs uppercase tracking-widest font-semibold">
            Select an examination to begin
          </p>
        </header>

        {isLoading ? (
          <div className="text-zinc-500 font-bold animate-pulse">Loading available tests...</div>
        ) : tests.length === 0 ? (
          <div className="text-zinc-500">No tests are currently available. Check back later.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tests.map((test) => (
              <Card key={test.id} className="bg-zinc-950 border-zinc-800 rounded-none shadow-none hover:border-zinc-600 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl tracking-tight">{test.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Duration</span>
                    <span>{test.duration_minutes} mins</span>
                  </div>
                  
                  <Link href={`/exam?testId=${test.id}`}>
                    <Button className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-bold h-12">
                      START TEST
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}