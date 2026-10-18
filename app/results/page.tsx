"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Define the exact shape of the results to clear the 'any' error
type ResultData = {
  score: number;
  totalAttempted: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
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