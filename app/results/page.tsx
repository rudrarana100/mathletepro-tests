"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { MathRenderer } from "@/components/MathRenderer";
import {
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  TrendingUp,
  BarChart2,
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
  options: string | string[];
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
  const size = 150;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const correctStroke = (correct / total) * circumference;
  const wrongStroke = (wrong / total) * circumference;
  const unattemptedStroke = (unattempted / total) * circumference;

  const correctOffset = 0;
  const wrongOffset = -correctStroke;
  const unattemptedOffset = -(correctStroke + wrongStroke);

  return (
    <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
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
          className={`text-2xl font-semibold font-mono tabular-nums tracking-tight ${
            score > 0 ? "text-emerald-400" : score < 0 ? "text-rose-400" : "text-zinc-100"
          }`}
        >
          {score > 0 ? `+${score}` : score}
        </span>
        <span className="text-xs text-zinc-400 font-normal">Score</span>
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
  const [testTitle, setTestTitle] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [markingScheme, setMarkingScheme] = useState({ pos: 4, neg: 1 });
  const [rankInfo, setRankInfo] = useState<RankInfo>({ rank: 1, totalCohort: 1, percentile: 100 });
  const [timeTaken] = useState<string>("Standard Duration");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "unattempted">("all");

  useEffect(() => {
    if (!resultId || resultId === "undefined") {
      setErrorMsg("No examination result identifier was provided.");
      setIsLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setIsLoading(true);

        const { data: myResult, error: resultError } = await supabase
          .from("test_results")
          .select("*")
          .eq("id", resultId)
          .maybeSingle();

        if (resultError || !myResult) {
          setErrorMsg("Examination scorecard not found or access is restricted.");
          setIsLoading(false);
          return;
        }

        const answersObj = myResult.answers || myResult.answers_data || {};
        const parsedResult: ResultData = {
          ...myResult,
          answers_data: answersObj,
        };
        setResultData(parsedResult);

        // Fetch test details & questions
        try {
          const { data: testData } = await supabase
            .from("tests")
            .select("title, positive_marks, negative_marks, duration_minutes")
            .eq("id", myResult.test_id)
            .maybeSingle();

          if (testData) {
            if (testData.title) setTestTitle(testData.title);
            setMarkingScheme({
              pos: testData.positive_marks ?? 4,
              neg: testData.negative_marks ?? 1,
            });
          }

          const { data: qData } = await supabase
            .from("questions")
            .select("id, statement, options, correct_option_index, solution, topic, image_url")
            .eq("test_id", myResult.test_id)
            .order("created_at", { ascending: true });

          if (qData && qData.length > 0) {
            setQuestions(qData as Question[]);
          }
        } catch {
          // ignore
        }

        // Calculate live cohort rank
        try {
          const { data: cohortResults } = await supabase
            .from("test_results")
            .select("score")
            .eq("test_id", myResult.test_id)
            .order("score", { ascending: false });

          if (cohortResults && cohortResults.length > 0) {
            const total = cohortResults.length;
            const rank = cohortResults.filter((r) => r.score > myResult.score).length + 1;
            const belowCount = cohortResults.filter((r) => r.score < myResult.score).length;
            const percentile = Math.round((belowCount / total) * 100);
            setRankInfo({
              rank,
              totalCohort: total,
              percentile: Math.max(1, percentile),
            });
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("Results load error:", err);
        setErrorMsg("Failed to load test evaluation scorecard.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [resultId, router, supabase]);

  // Topic accuracy statistics
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

  // Filtered Questions
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
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 space-y-3 font-sans">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-200 animate-spin rounded-full" />
        <div className="text-sm text-zinc-400 font-normal">
          Loading scorecard and solutions...
        </div>
      </div>
    );
  }

  if (errorMsg || !resultData) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 p-6 font-sans">
        <EmptyState
          icon={AlertCircle}
          title="Scorecard record not found"
          description={errorMsg || "The requested scorecard cannot be retrieved."}
          actionLabel="Return to available tests"
          actionHref="/student/tests"
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
      <div className="max-w-5xl mx-auto space-y-8 mt-2">
        <PageHeader
          title={testTitle ? `${testTitle} — Scorecard` : "Examination scorecard"}
          badge="Evaluated"
          description="Performance assessment and verified mathematical solutions"
          breadcrumbs={[
            { label: "Available tests", href: "/student/tests" },
            { label: testTitle || "Scorecard" },
          ]}
          action={
            <div className="flex items-center gap-2">
              <Link href="/student/tests">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 text-xs font-medium h-9"
                >
                  Available tests
                </Button>
              </Link>
              <Link href="/student/results">
                <Button
                  size="sm"
                  className="rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium h-9 transition-colors"
                >
                  My results
                </Button>
              </Link>
            </div>
          }
        />

        {/* 1. Hero Grid: Donut Chart, Scorecard, and Performance Rank */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Card className="md:col-span-7 bg-zinc-950 border-zinc-800 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-6 justify-between shadow-sm">
            <DonutChart
              correct={correct}
              wrong={wrong}
              unattempted={unattempted}
              score={resultData.score}
            />

            <div className="space-y-4 flex-1 w-full">
              <div>
                <span className="text-xs text-zinc-500 font-normal block">
                  Final evaluated score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-4xl font-semibold font-mono tabular-nums tracking-tight ${
                      resultData.score > 0
                        ? "text-emerald-400"
                        : resultData.score < 0
                        ? "text-rose-400"
                        : "text-zinc-100"
                    }`}
                  >
                    {resultData.score}
                  </span>
                  <span className="text-zinc-400 text-xs tabular-nums">
                    / {maxPossibleMarks} ({maxPossibleMarks > 0 ? Math.round((resultData.score / maxPossibleMarks) * 100) : 0}%)
                  </span>
                </div>
              </div>

              {/* Counts legend */}
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-zinc-900">
                <div className="p-2.5 rounded-md bg-zinc-900/40 border border-emerald-500/20">
                  <div className="text-[11px] text-emerald-400 font-medium">Correct</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-zinc-100">+{correct * markingScheme.pos}</div>
                  <div className="text-[10px] text-zinc-500">{correct} questions</div>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-900/40 border border-rose-500/20">
                  <div className="text-[11px] text-rose-400 font-medium">Incorrect</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-zinc-100">-{wrong * markingScheme.neg}</div>
                  <div className="text-[10px] text-zinc-500">{wrong} questions</div>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-900/40 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400 font-medium">Skipped</div>
                  <div className="text-base font-semibold font-mono tabular-nums text-zinc-100">0</div>
                  <div className="text-[10px] text-zinc-500">{unattempted} questions</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Rank, Percentile, Accuracy & Time Box */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3">
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span>Cohort rank</span>
                <Award className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-zinc-100">
                  #{rankInfo.rank} of {rankInfo.totalCohort}
                </div>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">Cohort rank</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span>Percentile</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-400">{rankInfo.percentile}%</div>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">Cohort ranking</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span>Accuracy</span>
                <BarChart2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold font-mono tabular-nums text-zinc-100">{accuracy}%</div>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">{correct} / {attempted} attempted</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span>Duration</span>
                <Clock className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-3">
                <div className="text-base font-medium text-zinc-100">{timeTaken}</div>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">Time spent</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Topic-wise Accuracy Breakdown */}
        {topicStats.length > 0 && (
          <section className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                Topic-wise accuracy breakdown
              </h2>
              <span className="text-xs text-zinc-500 font-normal">
                {topicStats.length} topics evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {topicStats.map((item) => (
                <div key={item.topic} className="p-3.5 rounded-md bg-zinc-900/40 border border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-zinc-200">{item.topic}</span>
                    <span className="text-emerald-400 font-semibold font-mono tabular-nums">{item.accuracy}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full border border-zinc-800 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 font-normal">
                    <span>{item.correct} correct</span>
                    <span>{item.total} inquiries</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Question-by-Question Review with Filters */}
        <section className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                Detailed question solutions
              </h2>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                Verify choices against official faculties explanations
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filter === "all" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("correct")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filter === "correct" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" : "text-zinc-400 hover:text-emerald-400"
                }`}
              >
                Correct ({correct})
              </button>
              <button
                type="button"
                onClick={() => setFilter("wrong")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filter === "wrong" ? "bg-rose-950/60 text-rose-400 border border-rose-500/30" : "text-zinc-400 hover:text-rose-400"
                }`}
              >
                Incorrect ({wrong})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unattempted")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filter === "unattempted" ? "bg-zinc-800 text-zinc-200" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Skipped ({unattempted})
              </button>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 border border-zinc-800 bg-zinc-950 text-center text-xs text-zinc-500 font-normal rounded-lg">
              No questions match the selected filter ({filter}).
            </div>
          ) : (
            <div className="space-y-5">
              {filteredQuestions.map((q) => {
                const globalIndex = questions.findIndex((item) => item.id === q.id);
                let parsedOptions: string[] = [];
                try {
                  parsedOptions =
                    typeof q.options === "string"
                      ? JSON.parse(q.options)
                      : Array.isArray(q.options)
                      ? q.options
                      : [];
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
                  <Card key={q.id} className="bg-zinc-950 border-zinc-800 rounded-lg shadow-sm space-y-4 p-5 sm:p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-zinc-300">
                          Question {globalIndex + 1}
                        </span>
                        {q.topic && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-xs text-zinc-400 font-normal">{q.topic}</span>
                          </>
                        )}
                      </div>

                      <div>
                        {isCorrect && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +{markingScheme.pos} Correct
                          </span>
                        )}
                        {isWrong && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" /> -{markingScheme.neg} Incorrect
                          </span>
                        )}
                        {isSkipped && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                            <HelpCircle className="w-3.5 h-3.5" /> 0 Skipped
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Statement with MathRenderer */}
                    <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-md text-sm md:text-base text-zinc-200 leading-relaxed space-y-3 font-normal">
                      <MathRenderer content={q.statement} />
                      {q.image_url && (
                        <div className="pt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={q.image_url}
                            alt="Question diagram"
                            className="max-h-72 max-w-full object-contain border border-zinc-800 bg-zinc-950 rounded"
                          />
                        </div>
                      )}
                    </div>

                    {/* Evaluated Options */}
                    <div className="space-y-2 pt-1">
                      <div className="text-xs text-zinc-400 font-medium">
                        Options:
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {parsedOptions.map((optText, optIdx) => {
                          const isThisCorrect = optIdx === q.correct_option_index;
                          const isThisSelected = studentOptIdx === optIdx;

                          let borderClass = "border-zinc-800 bg-zinc-900/30 text-zinc-300";
                          if (isThisCorrect && isThisSelected) {
                            borderClass = "border-emerald-500/60 bg-emerald-950/20 text-emerald-200";
                          } else if (isThisCorrect && !isThisSelected) {
                            borderClass = "border-emerald-500/40 bg-emerald-950/10 text-emerald-300";
                          } else if (!isThisCorrect && isThisSelected) {
                            borderClass = "border-rose-500/60 bg-rose-950/20 text-rose-200";
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center justify-between p-3.5 border rounded-md transition-colors text-sm ${borderClass}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium w-6 h-6 rounded flex items-center justify-center border border-zinc-800 bg-zinc-900 text-zinc-300 shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="text-sm text-zinc-200">
                                  <MathRenderer content={optText} />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {isThisSelected && (
                                  <span
                                    className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                                      isThisCorrect
                                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                                        : "border-rose-500/40 bg-rose-500/20 text-rose-300"
                                    }`}
                                  >
                                    Your response
                                  </span>
                                )}
                                {isThisCorrect && (
                                  <span className="px-2 py-0.5 text-[11px] font-medium rounded border border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
                                    Correct answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Official Solution */}
                    {q.solution && q.solution.trim() !== "" ? (
                      <div className="mt-3 p-4 border border-zinc-800 bg-zinc-900/50 rounded-md space-y-1.5">
                        <div className="text-xs text-zinc-400 font-medium">
                          Official explanation & solution:
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed font-normal pt-1">
                          <MathRenderer content={q.solution} />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 border border-zinc-900 bg-zinc-950 text-xs text-zinc-500 font-normal rounded">
                        No written derivation provided for this inquiry.
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Navigation Actions */}
        <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3 pb-8">
          <Link href="/student/tests" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 text-sm font-medium h-10 px-5"
            >
              Return to available tests
            </Button>
          </Link>

          <Link href="/student/results" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium h-10 px-6 transition-colors">
              View examination history
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
        <div className="min-h-screen bg-black text-zinc-400 flex items-center justify-center text-sm font-normal font-sans">
          Loading scorecard...
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}