"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

// Strict TypeScript Interfaces
interface ResultData {
  id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  answers_data: Record<string, number>;
}

interface Question {
  id: string;
  statement: string;
  options: string;
  correct_option_index: number;
  solution: string | null;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const resultId = searchParams.get("resultId");
  const router = useRouter();
  const supabase = createClient();

  // Replaced 'any' with strict interfaces
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [stats, setStats] = useState({ rank: 0, percentile: 0, totalStudents: 0 });
  const [markingScheme, setMarkingScheme] = useState({ pos: 4, neg: 1 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!resultId) {
      router.push("/dashboard");
      return;
    }

    const fetchResults = async () => {
      // 1. Fetch the specific result
      const { data: myResult } = await supabase.from("test_results").select("*").eq("id", resultId).single();
      if (!myResult) return;
      setResultData(myResult as ResultData);

      // Fetch the test marking scheme for dynamic UI badges
      const { data: testData } = await supabase.from("tests").select("positive_marks, negative_marks").eq("id", myResult.test_id).single();
      if (testData) {
        setMarkingScheme({ pos: testData.positive_marks ?? 4, neg: testData.negative_marks ?? 1 });
      }

      // 2. Fetch the questions and solutions
      const { data: qData } = await supabase.from("questions").select("*").eq("test_id", myResult.test_id);
      if (qData) setQuestions(qData as Question[]);

      // 3. Fetch all scores for this test to calculate Rank & Percentile
      const { data: allResults } = await supabase.from("test_results").select("score").eq("test_id", myResult.test_id).order("score", { ascending: false });
      
      if (allResults) {
        const rank = allResults.findIndex(r => r.score <= myResult.score) + 1;
        const total = allResults.length;
        const percentile = total > 1 ? ((total - rank) / total) * 100 : 100;
        
        setStats({ rank, percentile: Math.round(percentile * 10) / 10, totalStudents: total });
      }
      setIsLoading(false);
    };

    fetchResults();
  }, [resultId, router, supabase]);

  if (isLoading || !resultData) return <div className="flex h-screen items-center justify-center bg-black text-white font-bold tracking-widest uppercase text-sm animate-pulse">Calculating Percentiles...</div>;

  const totalIncorrect = resultData.total_attempted - resultData.total_correct;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-12 mt-4">
        
        {/* Geometric Hero Section */}
        <header className="border-b border-zinc-800 pb-10">
          <h1 className="text-5xl font-black tracking-tighter mb-2">Performance Analytics</h1>
          <p className="text-zinc-500 uppercase tracking-widest font-semibold text-sm">Detailed Score & Solution Breakdown</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-none p-6 flex flex-col items-center justify-center">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Total Score</div>
            <div className="text-5xl font-black text-white">{resultData.score}</div>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800 rounded-none p-6 flex flex-col items-center justify-center">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Rank</div>
            <div className="text-4xl font-black text-white">{stats.rank} <span className="text-lg text-zinc-600">/ {stats.totalStudents}</span></div>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800 rounded-none p-6 flex flex-col items-center justify-center">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Percentile</div>
            <div className="text-4xl font-black text-white">{stats.percentile}%</div>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800 rounded-none p-6 flex flex-col items-center justify-center">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Accuracy</div>
            <div className="text-4xl font-black text-white">
              {resultData.total_attempted > 0 ? Math.round((resultData.total_correct / resultData.total_attempted) * 100) : 0}%
            </div>
          </Card>
        </div>

        {/* Breakdown */}
        <div className="flex gap-4 border border-zinc-800 p-4 bg-zinc-950/50">
          <div className="flex-1 text-center border-r border-zinc-800"><span className="text-zinc-500 text-xs uppercase font-bold mr-2">Attempted:</span> <span className="font-bold">{resultData.total_attempted}</span></div>
          <div className="flex-1 text-center border-r border-zinc-800"><span className="text-green-500 text-xs uppercase font-bold mr-2">Correct:</span> <span className="font-bold">{resultData.total_correct}</span></div>
          <div className="flex-1 text-center"><span className="text-red-500 text-xs uppercase font-bold mr-2">Incorrect:</span> <span className="font-bold">{totalIncorrect}</span></div>
        </div>

        {/* Solutions Section */}
        <div className="space-y-8 pt-8">
          <h2 className="text-2xl font-bold tracking-tight">Question Solutions</h2>
          
          {questions.map((q, idx) => {
            const studentAns = resultData.answers_data[q.id];
            const isCorrect = studentAns === q.correct_option_index;
            const isUnattempted = studentAns === undefined;
            const parsedOptions = JSON.parse(q.options);

            return (
              <Card key={q.id} className="bg-black border border-zinc-800 rounded-none">
                <CardContent className="p-8 space-y-6">
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500 font-bold text-sm tracking-widest uppercase">Q{idx + 1}</span>
                    {isUnattempted ? (
                      <span className="px-3 py-1 text-xs font-bold bg-zinc-900 text-zinc-400 border border-zinc-700">UNATTEMPTED</span>
                    ) : isCorrect ? (
                      <span className="px-3 py-1 text-xs font-bold bg-green-900/30 text-green-500 border border-green-900">CORRECT (+{markingScheme.pos})</span>
                    ) : (
                      <span className="px-3 py-1 text-xs font-bold bg-red-900/30 text-red-500 border border-red-900">INCORRECT (-{markingScheme.neg})</span>
                    )}
                  </div>

                  <div className="text-xl font-medium"><Latex>{q.statement}</Latex></div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsedOptions.map((opt: string, optIdx: number) => {
                      const isStudentChoice = studentAns === optIdx;
                      const isActualCorrect = q.correct_option_index === optIdx;
                      
                      let boxStyle = "border-zinc-800 text-zinc-400";
                      if (isActualCorrect) boxStyle = "border-green-500 bg-green-900/10 text-green-400 font-bold shadow-[0_0_10px_rgba(34,197,94,0.1)]";
                      else if (isStudentChoice && !isActualCorrect) boxStyle = "border-red-500 bg-red-900/10 text-red-400";

                      return (
                        <div key={optIdx} className={`p-4 border rounded-none flex items-center ${boxStyle}`}>
                          <span className="font-bold mr-4 opacity-50">{String.fromCharCode(65 + optIdx)}.</span>
                          <Latex>{opt}</Latex>
                          {isStudentChoice && <span className="ml-auto text-xs font-bold uppercase tracking-widest opacity-50">Your Answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  {q.solution && (
                    <div className="mt-6 p-6 bg-zinc-950 border border-zinc-800">
                      <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Official Solution</div>
                      <div className="text-zinc-300 leading-relaxed"><Latex>{q.solution}</Latex></div>
                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="pb-12 pt-6">
          <Button onClick={() => router.push("/dashboard")} className="w-full md:w-auto h-14 px-12 rounded-none bg-white text-black hover:bg-zinc-200 font-bold tracking-wide">
            RETURN TO DASHBOARD
          </Button>
        </div>

      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}