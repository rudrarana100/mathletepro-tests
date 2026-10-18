"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ResultData = {
  score?: number;
  totalAttempted?: number;
  totalQuestions?: number;
  correctCount?: number;
  incorrectCount?: number;
  error?: string;
  details?: string;
};

export default function ResultsPage() {
  const [result, setResult] = useState<ResultData | null>(null);

  useEffect(() => {
    const savedResult = localStorage.getItem("final_result");
    if (savedResult) {
      setResult(JSON.parse(savedResult));
    }
  }, []);

  if (!result) return <div className="flex h-screen items-center justify-center">Calculating results...</div>;

  // NEW: If the API threw an error, render it clearly on the screen
  if (result.error) {
    return (
      <div className="container mx-auto p-8 max-w-3xl mt-10">
        <Card className="border-destructive p-6">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive font-bold">API Submission Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-auto text-red-400">
              {result.error} <br/>
              {result.details}
            </div>
            <Link href="/exam">
              <Button variant="outline" className="w-full">Go back to Exam</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-3xl mt-10">
      <Card className="text-center p-6 border-primary/50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Examination Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="text-6xl font-black text-primary border-b pb-6">
            {result.score} <span className="text-2xl text-muted-foreground font-normal">marks</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-lg">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-muted-foreground text-sm">Attempted</div>
              <div className="font-bold">{result.totalAttempted} / {result.totalQuestions}</div>
            </div>
            <div className="bg-green-500/10 text-green-500 p-4 rounded-lg">
              <div className="text-sm">Correct (+4)</div>
              <div className="font-bold">{result.correctCount}</div>
            </div>
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              <div className="text-sm">Incorrect (-1)</div>
              <div className="font-bold">{result.incorrectCount}</div>
            </div>
          </div>

          <div className="pt-8">
            <Link href="/">
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}