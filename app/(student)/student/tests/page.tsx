"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Award,
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

interface Test {
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

interface TestResult {
  id: string;
  test_id?: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  tests?: { title: string };
}

interface AttemptStatus {
  test_id: string;
  status: string;
}

export default function StudentTestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [myAttempts, setMyAttempts] = useState<TestResult[]>([]);
  const [inProgressAttempts, setInProgressAttempts] = useState<AttemptStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const loadStudentData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        router.push("/auth/login");
        return;
      }

      // Fetch published tests along with question relation
      const { data: testData, error: testErr } = await supabase
        .from("tests")
        .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time, questions(id)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (testErr) {
        setErrorMsg("Failed to load available tests: " + testErr.message);
      } else if (testData) {
        setTests(testData as unknown as Test[]);
      }

      // Fetch student's completed test results
      const { data: attemptsData } = await supabase
        .from("test_results")
        .select("id, test_id, score, total_attempted, total_correct, created_at, tests(title)")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (attemptsData) {
        setMyAttempts(attemptsData as unknown as TestResult[]);
      }

      // Check both database attempts and localStorage for in-progress tests
      const activeDrafts: AttemptStatus[] = [];

      try {
        const { data: activeDbAttempts } = await supabase
          .from("attempts")
          .select("id, test_id, status, end_time")
          .eq("student_id", user.id)
          .eq("status", "in_progress");

        if (activeDbAttempts) {
          const now = new Date();
          for (const att of activeDbAttempts) {
            if (!att.end_time || new Date(att.end_time) > now) {
              activeDrafts.push({ test_id: att.test_id, status: "in_progress" });
            }
          }
        }
      } catch {
        // attempts table query fallback
      }

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("mathlete_exam_") && !key.endsWith("_submitted")) {
            const testId = key.replace("mathlete_exam_", "");
            if (!activeDrafts.some((d) => d.test_id === testId)) {
              activeDrafts.push({ test_id: testId, status: "in_progress" });
            }
          }
        }
      } catch {
        // localStorage not accessible
      }

      setInProgressAttempts(activeDrafts);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const testsTaken = myAttempts.length;
  const averageScore =
    testsTaken > 0
      ? Math.round(myAttempts.reduce((acc, a) => acc + (a.score || 0), 0) / testsTaken)
      : 0;
  const bestScore = testsTaken > 0 ? Math.max(...myAttempts.map((a) => a.score || 0)) : 0;
  const totalAttemptedQuestions = myAttempts.reduce((acc, a) => acc + (a.total_attempted || 0), 0);
  const totalCorrectQuestions = myAttempts.reduce((acc, a) => acc + (a.total_correct || 0), 0);
  const averageAccuracy =
    totalAttemptedQuestions > 0
      ? Math.round((totalCorrectQuestions / totalAttemptedQuestions) * 100)
      : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <PageHeader
        title="Available Tests"
        badge="STUDENT PORTAL"
        description="Active test series and examination schedule"
        breadcrumbs={[
          { label: "Mathlete Pro", href: "/student/tests" },
          { label: "Available Tests" },
        ]}
        action={
          <Button
            onClick={loadStudentData}
            variant="outline"
            size="sm"
            className="rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 font-medium text-xs h-9"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Refresh feed
          </Button>
        }
      />

      {errorMsg && (
        <div className="p-4 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={loadStudentData}
            className="underline hover:text-white font-medium ml-4 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Metric Summary Strip */}
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
            <span>Average score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div
              className={`text-2xl font-semibold tabular-nums ${
                averageScore > 0 ? "text-emerald-400" : averageScore < 0 ? "text-rose-400" : "text-zinc-100"
              }`}
            >
              {averageScore > 0 ? `+${averageScore}` : averageScore}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Across all tests</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-lg flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Highest score</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-zinc-100">
              {bestScore > 0 ? `+${bestScore}` : bestScore}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-normal">Personal record</p>
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
      </section>

      {/* 2. Available Test Series */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Available test series
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {tests.length} {tests.length === 1 ? "test" : "tests"} active
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-zinc-950 border border-zinc-800 p-6 space-y-4 animate-pulse rounded-lg"
              >
                <div className="h-5 bg-zinc-800 w-2/3 rounded" />
                <div className="h-4 bg-zinc-900 w-1/3 rounded" />
                <div className="h-10 bg-zinc-900 w-full rounded" />
              </div>
            ))}
          </div>
        ) : tests.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No active examinations"
            description="There are currently no tests published. Check back soon or contact your instructor."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test) => {
              const existingResult = myAttempts.find((att) => att.test_id === test.id);
              const isInProgress = inProgressAttempts.some((att) => att.test_id === test.id);

              const qCount = test.questions?.length ?? 0;
              const pos = test.positive_marks ?? 4;
              const neg = test.negative_marks ?? 1;

              const now = new Date();
              const startTime = test.start_time ? new Date(test.start_time) : null;
              const endTime = test.end_time ? new Date(test.end_time) : null;
              const isUpcoming = startTime ? now < startTime : false;
              const isExpired = endTime ? now > endTime : false;

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

                      {/* Status Badges */}
                      {existingResult ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 rounded shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Completed ({existingResult.score > 0 ? `+${existingResult.score}` : existingResult.score})</span>
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-400 rounded shrink-0 animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>In progress</span>
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 border border-blue-500/40 bg-blue-500/10 text-blue-400 rounded shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>Opens {startTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-400 rounded shrink-0">
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 rounded shrink-0">
                          Available
                        </span>
                      )}
                    </div>

                    {/* Metadata items */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400 pt-1 border-t border-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="tabular-nums">{test.duration_minutes} mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="tabular-nums">{qCount} questions</span>
                      </div>
                      <div className="text-right tabular-nums text-zinc-400">
                        <span>+{pos} / -{neg}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div>
                    {existingResult ? (
                      <Link href={`/results?resultId=${existingResult.id}`} className="block">
                        <Button className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                          <span>View scorecard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    ) : isInProgress ? (
                      <Link href={`/exam?testId=${test.id}`} className="block">
                        <Button className="w-full h-9 rounded-md bg-amber-500 text-black hover:bg-amber-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                          <span>Resume test</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    ) : isUpcoming ? (
                      <Button disabled className="w-full h-9 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed">
                        Exam not open yet
                      </Button>
                    ) : isExpired ? (
                      <Button disabled className="w-full h-9 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed">
                        Exam window closed
                      </Button>
                    ) : (
                      <Link href={`/exam?testId=${test.id}`} className="block">
                        <Button className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                          <span>Start test</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Recent Exam Attempts */}
      <section className="space-y-4 pt-6 border-t border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Recent exam attempts
          </h2>
          <Link
            href="/student/results"
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
                <th className="py-3 px-4">Test title</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Attempted</th>
                <th className="py-3 px-4">Correct</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs font-normal">
                    Loading attempt records...
                  </td>
                </tr>
              ) : myAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs font-normal">
                    No examinations completed yet. Select an active test above to begin.
                  </td>
                </tr>
              ) : (
                myAttempts.slice(0, 5).map((item) => (
                  <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-zinc-100">
                      {item.tests?.title || "Exam"}
                    </td>
                    <td
                      className={`py-3.5 px-4 tabular-nums font-semibold ${
                        item.score > 0 ? "text-emerald-400" : item.score < 0 ? "text-rose-400" : "text-zinc-200"
                      }`}
                    >
                      {item.score > 0 ? `+${item.score}` : item.score}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-zinc-300">
                      {item.total_attempted}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-emerald-400">
                      {item.total_correct}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 text-xs tabular-nums">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/results?resultId=${item.id}`}>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
