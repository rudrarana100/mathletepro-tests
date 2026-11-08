"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  CheckCircle2,
  Award,
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export interface StudentTestItem {
  id: string;
  title: string;
  duration_minutes: number;
  positive_marks?: number;
  negative_marks?: number;
  is_published?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  questions?: Array<{ id: string }>;
}

export interface StudentResultItem {
  id: string;
  test_id?: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  tests?: {
    title: string;
    positive_marks?: number;
    questions?: Array<{ id: string }>;
  } | null;
}

export interface StudentAttemptItem {
  id: string;
  test_id: string;
  status: string;
  end_time?: string | null;
}

interface StudentTestsViewProps {
  tests: StudentTestItem[];
  myAttempts: StudentResultItem[];
  activeAttempts: StudentAttemptItem[];
}

export default function StudentTestsView({
  tests,
  myAttempts,
  activeAttempts: initialActiveAttempts,
}: StudentTestsViewProps) {
  const [inProgressIds, setInProgressIds] = useState<string[]>(
    initialActiveAttempts.map((a) => a.test_id)
  );

  // Check localStorage for any local in-progress test sessions
  useEffect(() => {
    try {
      setInProgressIds((prev) => {
        const draftIds = [...prev];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("mathlete_exam_") && !key.endsWith("_submitted")) {
            const testId = key.replace("mathlete_exam_", "");
            if (!draftIds.includes(testId)) {
              draftIds.push(testId);
            }
          }
        }
        return draftIds;
      });
    } catch {
      // localStorage may be disabled
    }
  }, []);

  // Section D.3: Calculate stats and format as "score / total marks (percentage)"
  const testsTaken = myAttempts.length;
  const totalScoreEarned = myAttempts.reduce((acc, a) => acc + (a.score || 0), 0);
  const totalMaxMarks = myAttempts.reduce((acc, a) => {
    const qCount = a.tests?.questions?.length ?? 0;
    const pos = a.tests?.positive_marks ?? 4;
    return acc + (qCount * pos);
  }, 0);
  const totalAttemptedQuestions = myAttempts.reduce((acc, a) => acc + (a.total_attempted || 0), 0);
  const totalCorrectQuestions = myAttempts.reduce((acc, a) => acc + (a.total_correct || 0), 0);
  const averageAccuracy =
    totalAttemptedQuestions > 0
      ? Math.round((totalCorrectQuestions / totalAttemptedQuestions) * 100)
      : 0;

  // Format helper: "score / total marks (percentage)" e.g. "24 / 60 (40%)"
  const formatScoreWithMax = (score: number, maxMarks: number) => {
    if (maxMarks <= 0) return `${score}`;
    const pct = Math.round((score / maxMarks) * 100);
    return `${score} / ${maxMarks} (${pct}%)`;
  };

  // Section D.4: List available tests first and completed tests below
  const completedTestMap = new Map<string, StudentResultItem>();
  myAttempts.forEach((att) => {
    if (att.test_id && !completedTestMap.has(att.test_id)) {
      completedTestMap.set(att.test_id, att);
    }
  });

  const availableTests = tests.filter((t) => !completedTestMap.has(t.id));
  const completedTests = tests.filter((t) => completedTestMap.has(t.id));

  // Date formatter: "7 Nov 2026" per Section C.3
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderTestCard = (test: StudentTestItem, existingResult?: StudentResultItem) => {
    const isInProgress = inProgressIds.includes(test.id);
    const qCount = test.questions?.length ?? 0;
    const pos = test.positive_marks ?? 4;
    const neg = test.negative_marks ?? 1;
    const totalMarks = qCount * pos;

    const now = new Date();
    const startTime = test.start_time ? new Date(test.start_time) : null;
    const endTime = test.end_time ? new Date(test.end_time) : null;
    const isUpcoming = startTime ? now < startTime : false;
    const isExpired = endTime ? now > endTime : false;

    // Section B.1: Tests with 0 questions must not show a Start button to students
    const hasNoQuestions = qCount === 0;

    return (
      <div
        key={test.id}
        className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors space-y-4"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-100 leading-snug">
              {test.title}
            </h3>

            {/* Status Badges in Sentence Case per Section D.2: "Available" (green), "Completed" (gray) */}
            {existingResult ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-400 rounded shrink-0">
                <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                <span>Completed</span>
              </span>
            ) : isInProgress ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-400 rounded shrink-0 animate-pulse">
                <Clock className="w-3 h-3" />
                <span>In progress</span>
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded shrink-0">
                <Clock className="w-3 h-3" />
                <span>Opens {startTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-400 rounded shrink-0">
                Closed
              </span>
            ) : (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 rounded shrink-0">
                Available
              </span>
            )}
          </div>

          {/* Metadata items including Total Marks per Section D.3 */}
          <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400 pt-2 border-t border-zinc-900">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="tabular-nums">{test.duration_minutes} mins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="tabular-nums">{qCount} questions</span>
            </div>
            <div className="tabular-nums text-zinc-300 font-medium">
              <span>{totalMarks} marks</span>
            </div>
            <div className="text-right tabular-nums text-zinc-400">
              <span>+{pos} / -{neg}</span>
            </div>
          </div>

          {/* Existing Score display in Section D.3 format */}
          {existingResult && (
            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Your score:</span>
              <span className="font-semibold text-emerald-400 tabular-nums">
                {formatScoreWithMax(existingResult.score, totalMarks)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div>
          {existingResult ? (
            <Link href={`/results?resultId=${existingResult.id}`} prefetch={true} className="block">
              <Button className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                <span>View scorecard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : isInProgress ? (
            <Link href={`/exam?testId=${test.id}`} prefetch={true} className="block">
              <Button className="w-full h-9 rounded-md bg-amber-500 text-black hover:bg-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                <span>Resume test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : hasNoQuestions ? (
            <Button disabled className="w-full h-9 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed">
              Questions being prepared
            </Button>
          ) : isUpcoming ? (
            <Button disabled className="w-full h-9 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed">
              Exam not open yet
            </Button>
          ) : isExpired ? (
            <Button disabled className="w-full h-9 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed">
              Exam window closed
            </Button>
          ) : (
            <Link href={`/exam?testId=${test.id}`} prefetch={true} className="block">
              <Button className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                <span>Start test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Section D.2: Removed Student portal badge and Refresh feed button; subtitle per D.4 */}
      <PageHeader
        title="Available Tests"
        description="Tests available to you"
        breadcrumbs={[
          { label: "Mathlete Pro", href: "/student/tests" },
          { label: "Available Tests" },
        ]}
      />

      {/* 1. Metric Summary Strip with D.3 score format */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Tests completed</span>
            <BookOpen className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">{testsTaken}</div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Completed attempts</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Overall score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">
              {totalMaxMarks > 0
                ? formatScoreWithMax(totalScoreEarned, totalMaxMarks)
                : `${totalScoreEarned}`}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Cumulative marks</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Accuracy rate</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">{averageAccuracy}%</div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Correct vs attempted</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Questions solved</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">
              {totalCorrectQuestions} / {totalAttemptedQuestions}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Accuracy count</p>
          </div>
        </div>
      </section>

      {/* 2. Available Test Series (Section D.4: List available tests first) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Available tests
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {availableTests.length} {availableTests.length === 1 ? "test" : "tests"} available
          </span>
        </div>

        {availableTests.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No tests currently available"
            description="You have completed all active test series or no new tests have been published yet."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableTests.map((test) => renderTestCard(test))}
          </div>
        )}
      </section>

      {/* 3. Completed Tests (Section D.4: List completed tests below) */}
      {completedTests.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              Completed tests
            </h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {completedTests.length} {completedTests.length === 1 ? "test" : "tests"} completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTests.map((test) => {
              const res = completedTestMap.get(test.id);
              return renderTestCard(test, res);
            })}
          </div>
        </section>
      )}

      {/* 4. Recent Exam Attempts Table */}
      <section className="space-y-4 pt-6 border-t border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Recent submissions
          </h2>
          <Link
            href="/student/results"
            prefetch={true}
            className="text-xs text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-1 transition-colors"
          >
            <span>View all results</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto border border-zinc-800 bg-zinc-950 rounded-lg">
          <table className="w-full text-left text-sm text-zinc-300 border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-medium bg-zinc-900/40">
                <th className="py-3 px-4 font-medium">Test title</th>
                <th className="py-3 px-4 font-medium">Score</th>
                <th className="py-3 px-4 font-medium">Attempted</th>
                <th className="py-3 px-4 font-medium">Correct</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {myAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs font-normal">
                    No examinations completed yet. Select an active test above to begin.
                  </td>
                </tr>
              ) : (
                myAttempts.slice(0, 5).map((item) => {
                  const testMax = (item.tests?.questions?.length ?? 0) * (item.tests?.positive_marks ?? 4);
                  return (
                    <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-zinc-100">
                        {item.tests?.title || "Exam"}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-semibold text-emerald-400">
                        {formatScoreWithMax(item.score, testMax)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-zinc-300">
                        {item.total_attempted}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-emerald-400">
                        {item.total_correct}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 text-xs tabular-nums">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/results?resultId=${item.id}`} prefetch={true}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-md border-zinc-800 bg-zinc-900 text-zinc-200 text-xs font-medium hover:bg-zinc-800 hover:text-white transition-colors"
                          >
                            View scorecard
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
