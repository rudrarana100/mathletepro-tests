"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, MinusCircle, AlertCircle } from "lucide-react";

interface QuestionRecord {
  id: string;
  statement: string;
  options: string | string[];
  correct_option_index: number;
  solution?: string | null;
  test_id?: string | null;
}

interface TestResult {
  id: string;
  student_id?: string | null;
  test_id?: string | null;
  score: number;
  total_attempted: number;
  total_correct: number;
  answers: Record<string | number, string | number>;
  created_at?: string;
}

function parseOptions(options: string | string[]): string[] {
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderMath(text: string | null | undefined) {
  if (!text) return null;
  // Split on block math $$...$$ first, then inline math $...$
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      const math = part.slice(2, -2).trim();
      return (
        <div key={index} className="my-2 overflow-x-auto py-1">
          <BlockMath math={math} />
        </div>
      );
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      const math = part.slice(1, -1).trim();
      return <InlineMath key={index} math={math} />;
    }
    return <span key={index}>{part}</span>;
  });
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const resultId = searchParams.get("resultId") || searchParams.get("id");
  const supabase = createClient();

  const [result, setResult] = useState<TestResult | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        let loadedResult: TestResult | null = null;

        // 1. If resultId is present in URL, query Supabase test_results
        if (resultId) {
          const { data, error } = await supabase
            .from("test_results")
            .select("*")
            .eq("id", resultId)
            .single();

          if (error) {
            console.warn("Could not fetch test_results by resultId from database:", error);
          } else if (data) {
            loadedResult = data as TestResult;
          }
        }

        // 2. Fallback: check localStorage for legacy/cached result
        if (!loadedResult && typeof window !== "undefined") {
          const cached = localStorage.getItem("final_result");
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              const cachedAnswers = JSON.parse(localStorage.getItem("exam_answers") || "{}");
              loadedResult = {
                id: parsed.resultId || resultId || "cached-result",
                score: parsed.score ?? 0,
                total_attempted: parsed.totalAttempted ?? 0,
                total_correct: parsed.correctCount ?? parsed.totalCorrect ?? 0,
                answers: parsed.answers || cachedAnswers || {},
                test_id: parsed.testId || null,
              };
            } catch (err) {
              console.error("Failed to parse cached exam result:", err);
            }
          }
        }

        if (!loadedResult) {
          setErrorMessage("No evaluation record found for this result ID. Please return to the dashboard or retake the test.");
          setIsLoading(false);
          return;
        }

        setResult(loadedResult);

        // 3. Fetch questions: filter by test_id if present, else get all questions
        let fetchedQuestions: QuestionRecord[] = [];
        if (loadedResult.test_id) {
          const { data: testQuestions } = await supabase
            .from("questions")
            .select("*")
            .eq("test_id", loadedResult.test_id);

          if (testQuestions && testQuestions.length > 0) {
            fetchedQuestions = testQuestions as QuestionRecord[];
          }
        }

        if (fetchedQuestions.length === 0) {
          const { data: allQuestions, error: qErr } = await supabase
            .from("questions")
            .select("*");

          if (qErr) {
            console.error("Error fetching questions:", qErr);
          }
          if (allQuestions) {
            fetchedQuestions = allQuestions as QuestionRecord[];
          }
        }

        setQuestions(fetchedQuestions);
      } catch (err) {
        console.error("Unexpected error loading results:", err);
        setErrorMessage("An unexpected error occurred while loading your exam results.");
      } finally {
        setIsLoading(false);
      }
    }

    loadResults();
  }, [resultId, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin mx-auto rounded-none" />
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            Calculating score & compiling review...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage || !result) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-8 rounded-none space-y-6">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h1 className="font-mono text-lg uppercase font-bold tracking-tight">Evaluation Notice</h1>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed font-sans">
            {errorMessage || "Unable to locate test result details."}
          </p>
          <div className="flex gap-4 pt-2">
            <Link href="/exam" className="flex-1">
              <Button variant="outline" className="w-full rounded-none border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider">
                <RotateCcw className="w-3.5 h-3.5 mr-2" /> Take Exam
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const studentAnswers = result.answers || {};
  const totalQuestions = questions.length;
  const attempted = result.total_attempted;
  const correct = result.total_correct;
  const incorrect = Math.max(0, attempted - correct);
  const unattempted = Math.max(0, totalQuestions - attempted);
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const maxPossibleMarks = totalQuestions * 4;

  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white pb-28">
      {/* Brutalist Top Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="container mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-zinc-400 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Portal
            </Link>
            <span className="text-zinc-700 font-mono">/</span>
            <span className="font-mono text-xs text-zinc-300 uppercase tracking-widest font-semibold">
              Test Performance Audit
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/exam">
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 hover:text-white text-xs font-mono tracking-wider uppercase h-9"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retake
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                size="sm"
                className="rounded-none bg-white text-black hover:bg-zinc-200 text-xs font-bold font-mono tracking-wider uppercase h-9 px-4"
              >
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 pt-10 space-y-12">
        {/* Header Title */}
        <div className="space-y-2 border-b border-zinc-800 pb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 font-bold">
            Examination Summary
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">
            Score Assessment
          </h1>
          {result.id && (
            <p className="font-mono text-[11px] text-zinc-600 tracking-wide">
              REFERENCE ID: {result.id}
            </p>
          )}
        </div>

        {/* Scorecard Hero */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Main Score Hero Card */}
          <div className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-none p-8 flex flex-col justify-between space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 font-semibold">
                  Final Evaluated Score
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span
                    className={`text-6xl md:text-7xl font-black font-mono tracking-tight ${
                      result.score > 0
                        ? "text-emerald-400"
                        : result.score < 0
                        ? "text-rose-400"
                        : "text-zinc-100"
                    }`}
                  >
                    {result.score > 0 ? `+${result.score}` : result.score}
                  </span>
                  <span className="font-mono text-sm text-zinc-500 uppercase">
                    / {maxPossibleMarks} marks
                  </span>
                </div>
              </div>
              <div className="font-mono text-xs px-2.5 py-1 border border-zinc-800 bg-zinc-900 text-zinc-400 uppercase tracking-wider">
                JEE Scheme (+4 / -1)
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-900 flex justify-between text-xs font-mono text-zinc-400 uppercase">
              <span>Performance Accuracy</span>
              <span className="font-bold text-zinc-200">{accuracy}%</span>
            </div>
          </div>

          {/* Breakdown Stats Grid */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-none p-5 flex flex-col justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">
                Attempted
              </span>
              <div className="mt-3">
                <div className="text-3xl font-black font-mono text-zinc-100">
                  {attempted}
                  <span className="text-sm font-normal text-zinc-500"> / {totalQuestions}</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 mt-1 uppercase">
                  {unattempted} Unattempted
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-emerald-950/60 rounded-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
                  Correct (+4)
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black font-mono text-emerald-400">
                  {correct}
                </div>
                <div className="text-[11px] font-mono text-emerald-600 mt-1 uppercase">
                  +{correct * 4} Marks gained
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-rose-950/60 rounded-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-rose-400 font-semibold">
                  Incorrect (-1)
                </span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black font-mono text-rose-400">
                  {incorrect}
                </div>
                <div className="text-[11px] font-mono text-rose-600 mt-1 uppercase">
                  -{incorrect} Negative mark
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-none p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">
                  Unattempted (0)
                </span>
                <MinusCircle className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black font-mono text-zinc-400">
                  {unattempted}
                </div>
                <div className="text-[11px] font-mono text-zinc-600 mt-1 uppercase">
                  0 Marks change
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review Section */}
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white font-mono">
                Question Review & Solutions
              </h2>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mt-0.5">
                Detailed comparison of student choices and verified KaTeX derivations
              </p>
            </div>
            <div className="font-mono text-xs text-zinc-500 uppercase">
              {totalQuestions} Total Inquiries
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-none p-8 text-center text-zinc-500 font-mono text-xs uppercase">
              No questions found for this examination.
            </div>
          ) : (
            <div className="space-y-8">
              {questions.map((q, idx) => {
                const parsedOptions = parseOptions(q.options);
                // Look up student answer by question index or UUID
                const studentVal =
                  studentAnswers[idx] ??
                  studentAnswers[String(idx)] ??
                  studentAnswers[q.id];

                const hasAnswered =
                  studentVal !== undefined && studentVal !== null && studentVal !== "";
                const studentOptIdx = hasAnswered
                  ? parseInt(String(studentVal), 10)
                  : null;

                const isCorrect =
                  studentOptIdx !== null && studentOptIdx === q.correct_option_index;
                const isIncorrect =
                  studentOptIdx !== null && studentOptIdx !== q.correct_option_index;
                const isSkipped = studentOptIdx === null;

                return (
                  <Card
                    key={q.id || idx}
                    className="bg-zinc-950 border-zinc-800 rounded-none shadow-none transition-colors"
                  >
                    <CardHeader className="pb-3 border-b border-zinc-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Question {idx + 1}
                          </span>
                          <span className="text-zinc-700 font-mono">•</span>
                          <span className="font-mono text-[11px] text-zinc-500 uppercase">
                            Single Choice
                          </span>
                        </div>

                        {/* Status Tag */}
                        <div>
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-none">
                              <CheckCircle2 className="w-3.5 h-3.5" /> +4 Correct
                            </span>
                          )}
                          {isIncorrect && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-none">
                              <XCircle className="w-3.5 h-3.5" /> -1 Incorrect
                            </span>
                          )}
                          {isSkipped && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-none">
                              <MinusCircle className="w-3.5 h-3.5" /> 0 Unattempted
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6">
                      {/* Mathematical Statement */}
                      <div className="p-4 bg-black border border-zinc-800 rounded-none text-base md:text-lg text-zinc-100 leading-relaxed font-sans">
                        {renderMath(q.statement)}
                      </div>

                      {/* Options Grid */}
                      <div className="space-y-3">
                        <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Response Options:
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {parsedOptions.map((optText, optIdx) => {
                            const isThisCorrectAnswer = optIdx === q.correct_option_index;
                            const isThisStudentChoice = studentOptIdx === optIdx;

                            let borderClass = "border-zinc-800 bg-zinc-900/30 text-zinc-400";
                            if (isThisCorrectAnswer && isThisStudentChoice) {
                              borderClass = "border-emerald-500 bg-emerald-950/20 text-emerald-200 font-medium";
                            } else if (isThisCorrectAnswer && !isThisStudentChoice) {
                              borderClass = "border-emerald-600/70 bg-emerald-950/10 text-emerald-300 font-medium";
                            } else if (!isThisCorrectAnswer && isThisStudentChoice) {
                              borderClass = "border-rose-500 bg-rose-950/20 text-rose-200 font-medium";
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center justify-between p-3.5 border rounded-none transition-colors ${borderClass}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs font-bold w-6 h-6 flex items-center justify-center border border-zinc-800 bg-black text-zinc-300 shrink-0">
                                    {optionLetters[optIdx] || optIdx + 1}
                                  </span>
                                  <div className="text-base text-zinc-100">
                                    {renderMath(optText)}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isThisStudentChoice && (
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border rounded-none ${
                                        isThisCorrectAnswer
                                          ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                                          : "border-rose-500/60 bg-rose-500/20 text-rose-300"
                                      }`}
                                    >
                                      Your Answer
                                    </span>
                                  )}
                                  {isThisCorrectAnswer && (
                                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/60 bg-emerald-500/20 text-emerald-300 rounded-none">
                                      Correct Answer
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* KaTeX Solution Explanation */}
                      {q.solution && q.solution.trim() !== "" ? (
                        <div className="p-4 border border-zinc-800 bg-black/80 rounded-none space-y-2">
                          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                            <span>// Formal Derivation & Solution</span>
                          </div>
                          <div className="text-sm text-zinc-300 leading-relaxed font-sans pt-1">
                            {renderMath(q.solution)}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border border-zinc-900 bg-black/40 text-xs font-mono text-zinc-600 uppercase">
                          No written explanation attached for this problem.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Actions */}
        <div className="pt-8 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-none border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider h-12 px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Student Dashboard
            </Button>
          </Link>

          <Link href="/exam" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider h-12 px-8">
              <RotateCcw className="w-4 h-4 mr-2" /> Start New Examination
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center font-mono text-xs uppercase tracking-widest">
          Loading Examination Assessment...
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}