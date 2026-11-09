"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { MathRenderer } from "@/components/MathRenderer";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ResultData {
  id: string;
  test_id: string;
  student_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  answers_data: Record<string, number>;
  answers?: Record<string, number>;
  submission_reason?: string;
  created_at?: string;
  time_taken_seconds?: number | null;
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
  available: boolean;
  rank?: number;
  total_attempts?: number;
  percentile?: number;
}

function formatTimeTaken(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return "Not available";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins} min ${secs} sec`;
}

function formatSubmissionDate(dateStr?: string): string {
  if (!dateStr) return "Not available";
  try {
    const d = new Date(dateStr);
    return `Submitted ${d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  } catch {
    return "Not available";
  }
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const resultId = searchParams.get("resultId");
  const router = useRouter();
  const supabase = createClient();

  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [testTitle, setTestTitle] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [markingScheme, setMarkingScheme] = useState({ pos: 4, neg: 1 });
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null);
  const [timeTaken, setTimeTaken] = useState<string>("Not available");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "unattempted">("all");
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});

  const toggleSolution = (qId: string) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

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

        // Fetch test details
        let loadedDuration = 60;
        try {
          const { data: testData } = await supabase
            .from("tests")
            .select("title, positive_marks, negative_marks, duration_minutes")
            .eq("id", myResult.test_id)
            .maybeSingle();

          if (testData) {
            if (testData.title) setTestTitle(testData.title);
            if (testData.duration_minutes) {
              loadedDuration = testData.duration_minutes;
              setDurationMinutes(testData.duration_minutes);
            }
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
          // Non-critical
        }

        // Fetch real time taken from attempts record
        try {
          const { data: attempt } = await supabase
            .from("attempts")
            .select("started_at, submitted_at, time_taken_seconds")
            .eq("user_id", myResult.student_id)
            .eq("test_id", myResult.test_id)
            .maybeSingle();

          if (attempt?.time_taken_seconds !== undefined && attempt?.time_taken_seconds !== null) {
            setTimeTaken(formatTimeTaken(attempt.time_taken_seconds));
          } else if (attempt?.started_at && attempt?.submitted_at) {
            const elapsed = Math.max(
              0,
              Math.round(
                (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000
              )
            );
            setTimeTaken(formatTimeTaken(elapsed));
          } else if (myResult.time_taken_seconds !== undefined && myResult.time_taken_seconds !== null) {
            setTimeTaken(formatTimeTaken(myResult.time_taken_seconds));
          } else {
            setTimeTaken("Not available");
          }
        } catch {
          setTimeTaken("Not available");
        }

        // Fetch rank and percentile calculated on the server
        try {
          const rankRes = await fetch(`/api/results/rank?resultId=${resultId}`);
          if (rankRes.ok) {
            const rData: RankInfo = await rankRes.json();
            if (rData.available && rData.total_attempts && rData.total_attempts >= 5) {
              setRankInfo(rData);
            } else {
              setRankInfo({ available: false });
            }
          } else {
            setRankInfo({ available: false });
          }
        } catch {
          setRankInfo({ available: false });
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

  // Topic accuracy statistics (shown only if >= 2 distinct non-general topics exist)
  const distinctTopics = useMemo(() => {
    const rawTopics = questions
      .map((q) => q.topic?.trim())
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== "general"));
    return Array.from(new Set(rawTopics));
  }, [questions]);

  const showTopicAccuracy = distinctTopics.length >= 2;

  const topicStats = useMemo(() => {
    if (!resultData || !showTopicAccuracy) return [];
    const studentAnswers = resultData.answers_data || {};
    const map = new Map<string, { total: number; correct: number }>();

    questions.forEach((q) => {
      const topic = q.topic?.trim() || "Uncategorized";
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
  }, [resultData, questions, showTopicAccuracy]);

  // First incorrect question for quick jump
  const firstIncorrectQuestion = useMemo(() => {
    if (!resultData) return null;
    const studentAnswers = resultData.answers_data || {};
    return questions.find((q) => {
      const studentVal = studentAnswers[q.id];
      return studentVal !== undefined && studentVal !== null && studentVal !== q.correct_option_index;
    });
  }, [questions, resultData]);

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
          Loading scorecard...
        </div>
      </div>
    );
  }

  if (errorMsg || !resultData) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 p-6 font-sans">
        <EmptyState
          icon={AlertCircle}
          title="Scorecard not found"
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
  const scorePct = maxPossibleMarks > 0 ? Math.round((resultData.score / maxPossibleMarks) * 100) : 0;

  // Short result line
  const resultLine =
    scorePct >= 80
      ? "Excellent performance on this test series."
      : scorePct >= 50
      ? "Good performance with room for improvement."
      : resultData.score > 0
      ? "Completed. Review your incorrect answers below to improve."
      : "Completed. Review the detailed solutions below to build accuracy.";

  const correctPct = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  const wrongPct = totalQuestions > 0 ? (wrong / totalQuestions) * 100 : 0;
  const unattemptedPct = totalQuestions > 0 ? (unattempted / totalQuestions) * 100 : 0;

  const isAutoSubmittedStrike =
    searchParams.get("reason") === "strike_limit_exceeded" ||
    resultData.submission_reason === "strike_limit_exceeded";

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans selection:bg-zinc-800 selection:text-white">
      <div className="max-w-4xl mx-auto space-y-6 mt-2">
        {/* 1. Header */}
        <header className="space-y-3 border-b border-zinc-800 pb-5">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-zinc-400">
            <Link href="/student/tests" className="hover:text-zinc-200 transition-colors">
              Available tests
            </Link>
            <span>/</span>
            <span className="text-zinc-200 truncate">{testTitle || "Scorecard"}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                {testTitle ? `${testTitle}: Scorecard` : "Examination: Scorecard"}
              </h1>
              <p className="text-xs text-zinc-400 font-normal mt-1">
                {formatSubmissionDate(resultData.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </header>

        {/* Notice if test was auto-submitted for strikes */}
        {isAutoSubmittedStrike && (
          <div className="bg-red-950/30 border border-red-500/40 rounded-lg p-3.5 flex items-center gap-3 text-red-300 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-normal">
              Your test was submitted because you left the exam window too many times.
            </span>
          </div>
        )}

        {/* 2. Score Block (One only, horizontal stacked bar) */}
        <Card className="bg-zinc-950 border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
            <div>
              <span className="text-xs text-zinc-400 font-normal block">Your score</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-semibold text-zinc-100 tracking-tight">
                  {resultData.score} / {maxPossibleMarks}
                </span>
                <span className="text-sm text-zinc-400 font-normal">
                  ({scorePct}%)
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 font-normal">
              {resultLine}
            </p>
          </div>

          {/* Horizontal stacked bar */}
          <div className="space-y-2 pt-2">
            <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden flex border border-zinc-800">
              {correctPct > 0 && (
                <div
                  style={{ width: `${correctPct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Correct: ${correct}`}
                />
              )}
              {wrongPct > 0 && (
                <div
                  style={{ width: `${wrongPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title={`Incorrect: ${wrong}`}
                />
              )}
              {unattemptedPct > 0 && (
                <div
                  style={{ width: `${unattemptedPct}%` }}
                  className="bg-zinc-700 h-full transition-all duration-300"
                  title={`Skipped: ${unattempted}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Correct ({correct})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span>Incorrect ({wrong})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 shrink-0" />
                <span>Skipped ({unattempted})</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Row of Stat Cards (2-column on mobile, 5-column on desktop) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Correct */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-xs text-zinc-400 font-normal">Correct</span>
            <div className="mt-2">
              <div className="text-2xl font-semibold text-zinc-100">{correct}</div>
              <p className="text-xs text-emerald-400 font-normal mt-0.5">
                {correct} correct, +{correct * markingScheme.pos} marks
              </p>
            </div>
          </div>

          {/* Incorrect */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-xs text-zinc-400 font-normal">Incorrect</span>
            <div className="mt-2">
              <div className="text-2xl font-semibold text-zinc-100">{wrong}</div>
              <p className="text-xs text-rose-400 font-normal mt-0.5">
                {wrong} incorrect, -{wrong * markingScheme.neg} marks
              </p>
            </div>
          </div>

          {/* Skipped */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-xs text-zinc-400 font-normal">Skipped</span>
            <div className="mt-2">
              <div className="text-2xl font-semibold text-zinc-100">{unattempted}</div>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                {unattempted} skipped
              </p>
            </div>
          </div>

          {/* Accuracy */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-xs text-zinc-400 font-normal">Accuracy</span>
            <div className="mt-2">
              <div className="text-2xl font-semibold text-zinc-100">{accuracy}%</div>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                {correct} of {attempted} attempted
              </p>
            </div>
          </div>

          {/* Time taken */}
          <div className="col-span-2 md:col-span-1 p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col justify-between shadow-sm">
            <span className="text-xs text-zinc-400 font-normal">Time taken</span>
            <div className="mt-2">
              <div className="text-base font-semibold text-zinc-100 font-mono">
                {timeTaken}
              </div>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                of {durationMinutes} min allowed
              </p>
            </div>
          </div>
        </div>

        {/* 4. Rank and Percentile (Shown ONLY when total submitted student attempts >= 5) */}
        {rankInfo && rankInfo.available && rankInfo.total_attempts && rankInfo.total_attempts >= 5 && (
          <Card className="p-5 bg-zinc-950 border-zinc-800 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            <div>
              <span className="text-xs text-zinc-400 font-normal block">Rank</span>
              <div className="text-xl font-semibold text-zinc-100 mt-0.5">
                Rank {rankInfo.rank} of {rankInfo.total_attempts}
              </div>
            </div>
            <div className="text-sm text-emerald-400 font-medium">
              Better than {rankInfo.percentile}% of students
            </div>
          </Card>
        )}

        {/* 5. Topic accuracy (Shown only if test has at least 2 distinct topics) */}
        {showTopicAccuracy && topicStats.length >= 2 && (
          <section className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                Topic accuracy
              </h2>
              <span className="text-xs text-zinc-400 font-normal">
                {topicStats.length} topics evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {topicStats.map((item) => (
                <div
                  key={item.topic}
                  className="p-3.5 rounded-md bg-zinc-900/40 border border-zinc-800 space-y-2"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-zinc-200">{item.topic}</span>
                    <span className="text-emerald-400 font-semibold">{item.accuracy}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full border border-zinc-800 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-400 font-normal">
                    <span>{item.correct} correct</span>
                    <span>{item.total} questions</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Question review */}
        <section className="space-y-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                Question review
              </h2>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                Compare your answers with the correct answers and solutions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Quick jump to first incorrect question */}
              {firstIncorrectQuestion && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    const el = document.getElementById(`question-${firstIncorrectQuestion.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-4 mr-2"
                >
                  First incorrect question →
                </button>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filter === "all"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("correct")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filter === "correct"
                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                      : "text-zinc-400 hover:text-emerald-400"
                  }`}
                >
                  Correct ({correct})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("wrong")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filter === "wrong"
                      ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                      : "text-zinc-400 hover:text-rose-400"
                  }`}
                >
                  Incorrect ({wrong})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unattempted")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filter === "unattempted"
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Skipped ({unattempted})
                </button>
              </div>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 border border-zinc-800 bg-zinc-950 text-center text-xs text-zinc-400 font-normal rounded-lg">
              No questions match the selected filter.
            </div>
          ) : (
            <div className="space-y-4">
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

                // Border color according to specification:
                // green for correct, red for incorrect, grey for skipped
                const borderClass = isCorrect
                  ? "border-l-4 border-l-emerald-500"
                  : isWrong
                  ? "border-l-4 border-l-rose-500"
                  : "border-l-4 border-l-zinc-500";

                const isExpanded = !!expandedSolutions[q.id];

                return (
                  <Card
                    id={`question-${q.id}`}
                    key={q.id}
                    className={`bg-zinc-950 border-zinc-800 rounded-lg shadow-sm space-y-4 p-5 sm:p-6 transition-all ${borderClass}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-zinc-200">
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
                            <CheckCircle2 className="w-3.5 h-3.5" /> +{markingScheme.pos} marks • Correct
                          </span>
                        )}
                        {isWrong && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" /> -{markingScheme.neg} marks • Incorrect
                          </span>
                        )}
                        {isSkipped && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                            <HelpCircle className="w-3.5 h-3.5" /> 0 marks • Skipped
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
                      <div className="text-xs text-zinc-400 font-normal">Options:</div>

                      <div className="grid grid-cols-1 gap-2">
                        {parsedOptions.map((optText, optIdx) => {
                          const isThisCorrect = optIdx === q.correct_option_index;
                          const isThisSelected = studentOptIdx === optIdx;

                          let optionStyle = "border-zinc-800 bg-zinc-900/30 text-zinc-300";
                          if (isThisCorrect && isThisSelected) {
                            optionStyle = "border-emerald-500/60 bg-emerald-950/20 text-emerald-200";
                          } else if (isThisCorrect && !isThisSelected) {
                            optionStyle = "border-emerald-500/40 bg-emerald-950/10 text-emerald-300";
                          } else if (!isThisCorrect && isThisSelected) {
                            optionStyle = "border-rose-500/60 bg-rose-950/20 text-rose-200";
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center justify-between p-3.5 border rounded-md transition-colors text-sm ${optionStyle}`}
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
                                {isThisSelected && isThisCorrect && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded border border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
                                    Your answer • Correct
                                  </span>
                                )}
                                {isThisSelected && !isThisCorrect && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded border border-rose-500/40 bg-rose-500/20 text-rose-300">
                                    Your answer
                                  </span>
                                )}
                                {!isThisSelected && isThisCorrect && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded border border-emerald-500/40 bg-emerald-500/20 text-emerald-300">
                                    Correct answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Collapsible Solution */}
                    <div className="pt-2 border-t border-zinc-900">
                      <button
                        type="button"
                        onClick={() => toggleSolution(q.id)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Hide solution</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Show solution</span>
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-4 border border-zinc-800 bg-zinc-900/50 rounded-md text-sm text-zinc-300 leading-relaxed font-normal">
                          {q.solution && q.solution.trim() !== "" ? (
                            <div className="space-y-1">
                              <span className="text-xs text-zinc-400 font-medium block">
                                Solution:
                              </span>
                              <div className="pt-1">
                                <MathRenderer content={q.solution} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">No solution provided.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Navigation Actions */}
        <footer className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3 pb-8">
          <Link href="/student/tests" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 text-sm font-medium h-10 px-5"
            >
              Available tests
            </Button>
          </Link>

          <Link href="/student/results" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium h-10 px-6 transition-colors">
              My results
            </Button>
          </Link>
        </footer>
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