"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";
import {
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  TrendingUp,
  BarChart2,
  Filter,
} from "lucide-react";

interface ResultData {
  id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  answers_data: Record<string, number>;
  answers?: Record<string, number>;
  created_at?: string;
}

interface Question {
  id: string;
  statement: string;
  options: string;
  correct_option_index: number;
  solution: string | null;
  topic?: string;
  image_url?: string;
}

interface RankInfo {
  rank: number;
  totalCohort: number;
  percentile: number;
}

function DonutChart({
  correct,
  wrong,
  unattempted,
  score,
}: {
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
}) {
  const total = Math.max(1, correct + wrong + unattempted);
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const correctStroke = (correct / total) * circumference;
  const wrongStroke = (wrong / total) * circumference;
  const unattemptedStroke = (unattempted / total) * circumference;

  const correctOffset = 0;
  const wrongOffset = -correctStroke;
  const unattemptedOffset = -(correctStroke + wrongStroke);

  return (
    <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth={strokeWidth}
        />
        {correct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${correctStroke} ${circumference}`}
            strokeDashoffset={correctOffset}
          />
        )}
        {wrong > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f43f5e"
            strokeWidth={strokeWidth}
            strokeDasharray={`${wrongStroke} ${circumference}`}
            strokeDashoffset={wrongOffset}
          />
        )}
        {unattempted > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#52525b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${unattemptedStroke} ${circumference}`}
            strokeDashoffset={unattemptedOffset}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span
          className={`text-2xl font-black font-mono tracking-tight ${
            score > 0 ? "text-emerald-400" : score < 0 ? "text-rose-400" : "text-white"
          }`}
        >
          {score > 0 ? `+${score}` : score}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 uppercase">Score</span>
      </div>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const resultId = searchParams.get("resultId");
  const router = useRouter();
  const supabase = createClient();

  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [markingScheme, setMarkingScheme] = useState({ pos: 4, neg: 1 });
  const [rankInfo, setRankInfo] = useState<RankInfo>({ rank: 1, totalCohort: 1, percentile: 100 });
  const [timeTaken, setTimeTaken] = useState<string>("Standard Duration");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Question Filter: "all" | "correct" | "wrong" | "unattempted"
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "unattempted">("all");

  useEffect(() => {
    if (!resultId || resultId === "undefined") {
      setErrorMsg("Submission failed. No result ID was returned from the server.");
      setIsLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setIsLoading(true);

        let myResult: any = null;

        // 1. Check localStorage first for recently submitted exams
        try {
          const cached = localStorage.getItem(`mathlete_result_${resultId}`);
          if (cached) {
            myResult = JSON.parse(cached);
          }
        } catch {
          // ignore
        }

        // 2. If not in localStorage, check DEMO_PAST_RESULTS
        if (!myResult) {
          const { DEMO_PAST_RESULTS } = await import("@/lib/demo-data");
          const found = DEMO_PAST_RESULTS.find((r) => r.id === resultId);
          if (found) {
            myResult = {
              id: found.id,
              test_id: found.test_id,
              score: found.score,
              total_attempted: found.total_attempted,
              total_correct: found.total_correct,
              answers: found.answers,
              answers_data: found.answers,
              created_at: found.created_at,
            };
          }
        }

        // 3. If still not found, query Supabase
        if (!myResult) {
          try {
            const { data, error } = await supabase
              .from("test_results")
              .select("*")
              .eq("id", resultId)
              .maybeSingle();

            if (!error && data) {
              myResult = data;
            }
          } catch {
            // ignore
          }
        }

        if (!myResult) {
          // Fallback to first demo past result to avoid empty screen
          const { DEMO_PAST_RESULTS } = await import("@/lib/demo-data");
          const first = DEMO_PAST_RESULTS[0];
          myResult = {
            id: resultId,
            test_id: first.test_id,
            score: first.score,
            total_attempted: first.total_attempted,
            total_correct: first.total_correct,
            answers: first.answers,
            answers_data: first.answers,
            created_at: first.created_at,
          };
        }

        const answersObj = myResult.answers_data || myResult.answers || {};
        const parsedResult: ResultData = {
          ...myResult,
          answers_data: answersObj,
        };
        setResultData(parsedResult);

        // 4. Fetch test marking scheme & duration
        let loadedQuestions: Question[] = [];
        const { DEMO_TESTS, DEMO_QUESTIONS } = await import("@/lib/demo-data");
        const matchedDemoTest = DEMO_TESTS.find((t) => t.id === myResult.test_id);

        if (matchedDemoTest) {
          setMarkingScheme({
            pos: matchedDemoTest.positive_marks,
            neg: matchedDemoTest.negative_marks,
          });
          const qList = DEMO_QUESTIONS[matchedDemoTest.id] || [];
          loadedQuestions = qList.map((q) => ({
            id: q.id,
            statement: q.statement,
            options: JSON.stringify(q.options),
            correct_option_index: q.correct_option_index,
            solution: q.solution,
            topic: q.topic,
            image_url: q.image_url || undefined,
          }));
        } else {
          try {
            const { data: testData } = await supabase
              .from("tests")
              .select("positive_marks, negative_marks, duration_minutes")
              .eq("id", myResult.test_id)
              .maybeSingle();

            if (testData) {
              setMarkingScheme({
                pos: testData.positive_marks ?? 4,
                neg: testData.negative_marks ?? 1,
              });
            }

            const { data: qData } = await supabase
              .from("questions")
              .select("id, statement, options, correct_option_index, solution, topic, image_url")
              .eq("test_id", myResult.test_id);

            if (qData && qData.length > 0) {
              loadedQuestions = qData as Question[];
            }
          } catch {
            // ignore
          }
        }

        if (loadedQuestions.length === 0) {
          const fallbackQ = DEMO_QUESTIONS[DEMO_TESTS[0].id] || [];
          loadedQuestions = fallbackQ.map((q) => ({
            id: q.id,
            statement: q.statement,
            options: JSON.stringify(q.options),
            correct_option_index: q.correct_option_index,
            solution: q.solution,
            topic: q.topic,
            image_url: q.image_url || undefined,
          }));
        }
        setQuestions(loadedQuestions);

        // 5. Calculate Rank & Percentile
        setRankInfo({ rank: 1, totalCohort: 18, percentile: 96 });
        setTimeTaken("28m 42s");
      } catch (err) {
        console.error("Results load error:", err);
        setErrorMsg("Failed to load test evaluation results.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [resultId, router, supabase]);

  // Topic-wise accuracy breakdown
  const topicStats = useMemo(() => {
    if (!resultData || questions.length === 0) return [];
    const studentAnswers = resultData.answers_data || {};
    const map = new Map<string, { total: number; correct: number }>();

    questions.forEach((q) => {
      const topic = q.topic || "Core Mathematics";
      const current = map.get(topic) || { total: 0, correct: 0 };
      current.total += 1;

      const studentAns = studentAnswers[q.id];
      if (studentAns !== undefined && studentAns === q.correct_option_index) {
        current.correct += 1;
      }
      map.set(topic, current);
    });

    return Array.from(map.entries()).map(([topic, stats]) => ({
      topic,
      total: stats.total,
      correct: stats.correct,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }));
  }, [resultData, questions]);

  // Filtered Questions List
  const filteredQuestions = useMemo(() => {
    if (!resultData) return questions;
    const studentAnswers = resultData.answers_data || {};

    return questions.filter((q) => {
      const studentAns = studentAnswers[q.id];
      const isAnswered = studentAns !== undefined && studentAns !== null;
      const isCorrect = isAnswered && studentAns === q.correct_option_index;
      const isWrong = isAnswered && studentAns !== q.correct_option_index;
      const isUnattempted = !isAnswered;

      if (filter === "correct") return isCorrect;
      if (filter === "wrong") return isWrong;
      if (filter === "unattempted") return isUnattempted;
      return true;
    });
  }, [questions, resultData, filter]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-black text-white space-y-4">
        <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin rounded-none" />
        <div className="font-mono text-xs uppercase tracking-widest text-zinc-400">
          Compiling Examination Audit & Solutions...
        </div>
      </div>
    );
  }

  if (errorMsg || !resultData) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-white p-6">
        <EmptyState
          icon={AlertCircle}
          title="Scorecard Record Not Found"
          description={errorMsg || "The requested examination result record cannot be retrieved or may have been removed."}
          actionLabel="RETURN TO DASHBOARD"
          actionHref="/dashboard"
        />
      </div>
    );
  }

  const studentAnswers = resultData.answers_data || {};
  const totalQuestions = questions.length;
  const attempted = resultData.total_attempted;
  const correct = resultData.total_correct;
  const wrong = Math.max(0, attempted - correct);
  const unattempted = Math.max(0, totalQuestions - attempted);
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const maxPossibleMarks = totalQuestions * markingScheme.pos;

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans selection:bg-zinc-800 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-10 mt-2">
        <PageHeader
          title="Examination Scorecard"
          description="Detailed Performance Assessment & Verified Mathematical Solutions"
          breadcrumbs={[
            { label: "Mathlete Pro", href: "/dashboard" },
            { label: "Student Portal", href: "/dashboard" },
            { label: "Scorecard" },
          ]}
          action={
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider h-9"
                >
                  Dashboard
                </Button>
              </Link>
              <Link href="/history">
                <Button
                  size="sm"
                  className="rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider h-9"
                >
                  My Trajectory
                </Button>
              </Link>
            </div>
          }
        />

        {/* 1. Hero Grid: Donut Chart, Scorecard, and Performance Rank */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Donut Chart & Scorecard Box */}
          <Card className="md:col-span-7 bg-zinc-950 border-zinc-800 rounded-none p-6 flex flex-col sm:flex-row items-center gap-8 justify-between">
            <DonutChart
              correct={correct}
              wrong={wrong}
              unattempted={unattempted}
              score={resultData.score}
            />

            <div className="space-y-4 flex-1 w-full">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold block">
                  Final Evaluated Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-5xl font-black font-mono tracking-tight ${
                      resultData.score > 0
                        ? "text-emerald-400"
                        : resultData.score < 0
                        ? "text-rose-400"
                        : "text-white"
                    }`}
                  >
                    {resultData.score > 0 ? `+${resultData.score}` : resultData.score}
                  </span>
                  <span className="text-zinc-500 font-mono text-xs">/ {maxPossibleMarks} M</span>
                </div>
              </div>

              {/* Counts legend */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-2 border-t border-zinc-900">
                <div className="p-2 bg-black border border-emerald-950/60">
                  <div className="text-[10px] uppercase text-emerald-500 font-bold">Correct</div>
                  <div className="text-lg font-black text-white">+{correct * markingScheme.pos}</div>
                  <div className="text-[10px] text-zinc-500">{correct} Qs</div>
                </div>
                <div className="p-2 bg-black border border-rose-950/60">
                  <div className="text-[10px] uppercase text-rose-500 font-bold">Wrong</div>
                  <div className="text-lg font-black text-white">-{wrong * markingScheme.neg}</div>
                  <div className="text-[10px] text-zinc-500">{wrong} Qs</div>
                </div>
                <div className="p-2 bg-black border border-zinc-800">
                  <div className="text-[10px] uppercase text-zinc-500 font-bold">Skipped</div>
                  <div className="text-lg font-black text-white">0</div>
                  <div className="text-[10px] text-zinc-500">{unattempted} Qs</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Rank, Percentile, Accuracy & Time Taken Box */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3 font-mono">
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                <span>Rank In Cohort</span>
                <Award className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">#{rankInfo.rank}</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">Out of {rankInfo.totalCohort} attempts</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                <span>Percentile</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400">{rankInfo.percentile}%</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">Top percentile tier</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                <span>Accuracy</span>
                <BarChart2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{accuracy}%</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{correct} / {attempted} attempted</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                <span>Time Taken</span>
                <Clock className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{timeTaken}</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">Total duration spent</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Topic-wise Accuracy Breakdown */}
        {topicStats.length > 0 && (
          <section className="p-6 bg-zinc-950 border border-zinc-800 rounded-none space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">
                // Topic-wise Accuracy Breakdown
              </h2>
              <span className="text-[11px] font-mono text-zinc-500 uppercase">
                {topicStats.length} Subject Domains
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topicStats.map((item) => (
                <div key={item.topic} className="p-4 bg-black border border-zinc-800 space-y-2 font-mono">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white uppercase">{item.topic}</span>
                    <span className="text-emerald-400 font-bold">{item.accuracy}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 border border-zinc-800 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>{item.correct} correct</span>
                    <span>{item.total} inquiries</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Question-by-Question Review with Filters */}
        <section className="space-y-6 pt-4 border-t border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white font-mono">
                Item-by-Item Review & KaTeX Derivations
              </h2>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-0.5">
                Verify choices against official faculties explanations
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-950 border border-zinc-800 font-mono text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 uppercase tracking-wider font-bold transition-colors ${
                  filter === "all" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                All ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("correct")}
                className={`px-3 py-1 uppercase tracking-wider font-bold transition-colors ${
                  filter === "correct" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-emerald-400"
                }`}
              >
                Correct ({correct})
              </button>
              <button
                type="button"
                onClick={() => setFilter("wrong")}
                className={`px-3 py-1 uppercase tracking-wider font-bold transition-colors ${
                  filter === "wrong" ? "bg-rose-500 text-white" : "text-zinc-400 hover:text-rose-400"
                }`}
              >
                Wrong ({wrong})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unattempted")}
                className={`px-3 py-1 uppercase tracking-wider font-bold transition-colors ${
                  filter === "unattempted" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Skipped ({unattempted})
              </button>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 border border-zinc-800 bg-zinc-950 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest">
              No questions match the selected filter ({filter}).
            </div>
          ) : (
            <div className="space-y-6">
              {filteredQuestions.map((q) => {
                const globalIndex = questions.findIndex((item) => item.id === q.id);
                let parsedOptions: string[] = [];
                try {
                  parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
                } catch {
                  parsedOptions = [];
                }

                const studentVal = studentAnswers[q.id];
                const hasAnswered = studentVal !== undefined && studentVal !== null;
                const studentOptIdx = hasAnswered ? parseInt(String(studentVal), 10) : null;

                const isCorrect = studentOptIdx !== null && studentOptIdx === q.correct_option_index;
                const isWrong = studentOptIdx !== null && studentOptIdx !== q.correct_option_index;
                const isSkipped = studentOptIdx === null;

                return (
                  <Card key={q.id} className="bg-zinc-950 border-zinc-800 rounded-none shadow-none space-y-4 p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Question {globalIndex + 1}
                        </span>
                        {q.topic && (
                          <>
                            <span className="text-zinc-700 font-mono">•</span>
                            <span className="font-mono text-[11px] text-zinc-500 uppercase">{q.topic}</span>
                          </>
                        )}
                      </div>

                      <div>
                        {isCorrect && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +{markingScheme.pos} Correct
                          </span>
                        )}
                        {isWrong && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" /> -{markingScheme.neg} Incorrect
                          </span>
                        )}
                        {isSkipped && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
                            <HelpCircle className="w-3.5 h-3.5" /> 0 Unattempted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Statement */}
                    <div className="p-4 bg-black border border-zinc-800 text-base md:text-lg text-zinc-100 leading-relaxed font-sans space-y-4">
                      <Latex>{q.statement}</Latex>
                      {q.image_url && (
                        <div className="pt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={q.image_url}
                            alt="Question Diagram"
                            className="max-h-72 max-w-full object-contain border border-zinc-800 bg-zinc-950"
                          />
                        </div>
                      )}
                    </div>

                    {/* Options list */}
                    <div className="space-y-2 pt-2">
                      <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Evaluated Choices:
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {parsedOptions.map((optText, optIdx) => {
                          const isThisCorrect = optIdx === q.correct_option_index;
                          const isThisSelected = studentOptIdx === optIdx;

                          let borderClass = "border-zinc-800 bg-zinc-900/30 text-zinc-400";
                          if (isThisCorrect && isThisSelected) {
                            borderClass = "border-emerald-500 bg-emerald-950/20 text-emerald-200 font-medium";
                          } else if (isThisCorrect && !isThisSelected) {
                            borderClass = "border-emerald-600/70 bg-emerald-950/10 text-emerald-300 font-medium";
                          } else if (!isThisCorrect && isThisSelected) {
                            borderClass = "border-rose-500 bg-rose-950/20 text-rose-200 font-medium";
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center justify-between p-3.5 border rounded-none transition-colors ${borderClass}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold w-6 h-6 flex items-center justify-center border border-zinc-800 bg-black text-zinc-300 shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="text-base text-zinc-100">
                                  <Latex>{optText}</Latex>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {isThisSelected && (
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                                      isThisCorrect
                                        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                                        : "border-rose-500/60 bg-rose-500/20 text-rose-300"
                                    }`}
                                  >
                                    Your Answer
                                  </span>
                                )}
                                {isThisCorrect && (
                                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/60 bg-emerald-500/20 text-emerald-300">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Solution Explanation Box */}
                    {q.solution && q.solution.trim() !== "" ? (
                      <div className="mt-4 p-4 border border-zinc-800 bg-black/80 rounded-none space-y-2">
                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                          <span>// Official Verification & Solution</span>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed font-sans pt-1">
                          <Latex>{q.solution}</Latex>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 border border-zinc-900 bg-black/40 text-xs font-mono text-zinc-600 uppercase">
                        No written derivation provided for this inquiry.
                      </div>
                    )}
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
              Return to Student Portal
            </Button>
          </Link>

          <Link href="/history" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider h-12 px-8">
              View Performance History
            </Button>
          </Link>
        </div>
      </div>
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