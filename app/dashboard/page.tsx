"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AppSidebar from "@/components/AppSidebar";
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

export default function Dashboard() {
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

      // 1. Check for demo session cookie
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
      };
      const demoVal = getCookie("mathlete_demo_user");
      const isDemo = Boolean(demoVal);

      let fetchedTests: Test[] = [];
      let fetchedAttempts: TestResult[] = [];

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Fetch active tests along with question count from live database
        const { data: testData, error: testErr } = await supabase
          .from("tests")
          .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time, questions(id)")
          .order("title", { ascending: true });

        if (!testErr && testData && testData.length > 0) {
          const published = (testData as unknown as Test[]).filter(
            (t) => t.is_published !== false
          );
          fetchedTests = published;
        }

        if (user) {
          const { data: attemptsData } = await supabase
            .from("test_results")
            .select("id, test_id, score, total_attempted, total_correct, created_at, tests(title)")
            .eq("student_id", user.id)
            .order("created_at", { ascending: false });

          if (attemptsData) {
            fetchedAttempts = attemptsData as unknown as TestResult[];
          }
        }
      } catch {
        // Live database offline or unreachable
      }

      // If no live tests returned (or demo session active), populate with rich built-in tests
      if (fetchedTests.length === 0) {
        const { DEMO_TESTS, DEMO_PAST_RESULTS } = await import("@/lib/demo-data");
        fetchedTests = DEMO_TESTS as unknown as Test[];
        if (fetchedAttempts.length === 0) {
          fetchedAttempts = DEMO_PAST_RESULTS as unknown as TestResult[];
        }
      }

      // Check localStorage for any local attempt submissions
      try {
        const localResultsRaw = localStorage.getItem("mathlete_local_results");
        if (localResultsRaw) {
          const localParsed: TestResult[] = JSON.parse(localResultsRaw);
          fetchedAttempts = [...localParsed, ...fetchedAttempts];
        }
      } catch {
        // ignore
      }

      setTests(fetchedTests);
      setMyAttempts(fetchedAttempts);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
      // Fallback gracefully so page always renders
      const { DEMO_TESTS, DEMO_PAST_RESULTS } = await import("@/lib/demo-data");
      setTests(DEMO_TESTS as unknown as Test[]);
      setMyAttempts(DEMO_PAST_RESULTS as unknown as TestResult[]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Performance Metrics
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
    <AppSidebar>
      <div className="max-w-5xl mx-auto space-y-10">
        <PageHeader
          title="Student Portal"
          description="Examination Center & Performance Analytics"
          breadcrumbs={[
            { label: "Mathlete Pro", href: "/dashboard" },
            { label: "Student Portal" },
          ]}
          action={
            <Button
              onClick={loadStudentData}
              variant="outline"
              size="sm"
              className="rounded-none border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider h-9"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" /> Refresh Feed
            </Button>
          }
        />

        {errorMsg && (
          <div className="p-4 border border-red-500/40 bg-red-950/20 text-red-400 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadStudentData}
              className="underline hover:text-white uppercase tracking-wider font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Stats Strip at Top */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-none flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-semibold">
              <span>Tests Completed</span>
              <BookOpen className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-white">{testsTaken}</div>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Attempted test series</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-none flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-semibold">
              <span>Average Score</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div
                className={`text-3xl font-black font-mono ${
                  averageScore > 0 ? "text-emerald-400" : averageScore < 0 ? "text-rose-400" : "text-white"
                }`}
              >
                {averageScore > 0 ? `+${averageScore}` : averageScore}
              </div>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Mean student mark</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-none flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-semibold">
              <span>Highest Score</span>
              <Award className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-white">
                {bestScore > 0 ? `+${bestScore}` : bestScore}
              </div>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Personal best mark</p>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-none flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-semibold">
              <span>Accuracy Rate</span>
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-white">{averageAccuracy}%</div>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Overall precision</p>
            </div>
          </div>
        </section>

        {/* 2. Active Examinations Section */}
        <section id="active-tests" className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h2 className="text-base font-bold tracking-tight text-white uppercase font-mono">
              Available Test Series
            </h2>
            <span className="text-xs font-mono text-zinc-500 uppercase">
              {tests.length} Active
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-zinc-950 border border-zinc-800 p-6 space-y-4 animate-pulse rounded-none"
                >
                  <div className="h-6 bg-zinc-800 w-3/4 rounded-none" />
                  <div className="h-4 bg-zinc-900 w-1/3 rounded-none" />
                  <div className="h-12 bg-zinc-900 w-full rounded-none" />
                </div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No Active Examinations"
              description="No examinations are currently active in this semester repository. Please check back soon or consult faculty."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tests.map((test) => {
                const existingResult = myAttempts.find((att) => att.test_id === test.id);
                const isInProgress = inProgressAttempts.some((att) => att.test_id === test.id);

                const qCount = test.questions?.length ?? 0;
                const pos = test.positive_marks ?? 4;
                const neg = test.negative_marks ?? 1;
                const totalMarks = qCount * pos;

                const now = new Date();
                const startTime = test.start_time ? new Date(test.start_time) : null;
                const endTime = test.end_time ? new Date(test.end_time) : null;
                const isUpcoming = startTime ? now < startTime : false;
                const isExpired = endTime ? now > endTime : false;

                return (
                  <Card key={test.id} className="bg-zinc-950 border-zinc-800 rounded-none shadow-none flex flex-col justify-between hover:border-zinc-700 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl font-bold tracking-tight text-white">
                          {test.title}
                        </CardTitle>

                        {/* Status Badges: Completed / In Progress / Upcoming / Closed / Live */}
                        {existingResult ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> COMPLETED ({existingResult.score > 0 ? `+${existingResult.score}` : existingResult.score} PTS)
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold shrink-0 animate-pulse">
                            <Clock className="w-3 h-3" /> IN PROGRESS
                          </span>
                        ) : isUpcoming ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-blue-500/40 bg-blue-500/10 text-blue-400 font-bold shrink-0">
                            <Clock className="w-3 h-3" /> OPENS {startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-red-500/40 bg-red-500/10 text-red-400 font-bold shrink-0">
                            CLOSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 font-bold shrink-0">
                            LIVE
                          </span>
                        )}
                      </div>

                      <CardDescription className="text-zinc-500 font-mono text-xs pt-1 flex flex-col gap-0.5">
                        <span>Duration: {test.duration_minutes} mins</span>
                        {(startTime || endTime) && (
                          <span className="text-[11px] text-zinc-600">
                            Window: {startTime ? startTime.toLocaleDateString() + " " + startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Open"} – {endTime ? endTime.toLocaleDateString() + " " + endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Indefinite"}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-0">
                      {/* Detailed Metric Strip */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 bg-black border border-zinc-800">
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider text-[10px] block">Questions</span>
                          <span className="font-bold text-zinc-200">{qCount > 0 ? `${qCount} Inquiries` : "Standard Core"}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider text-[10px] block">Marking</span>
                          <span className="font-bold text-zinc-200">{totalMarks > 0 ? `${totalMarks} M (+${pos}/-${neg})` : `+${pos} / -${neg}`}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {existingResult ? (
                        <Link href={`/results?resultId=${existingResult.id}`} className="block">
                          <Button className="w-full h-11 rounded-none bg-zinc-900 border border-zinc-700 text-zinc-100 hover:bg-zinc-800 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                            <span>VIEW RESULT</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ) : isInProgress ? (
                        <Link href={`/exam?testId=${test.id}`} className="block">
                          <Button className="w-full h-11 rounded-none bg-amber-500 text-black hover:bg-amber-400 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                            <span>RESUME TEST</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ) : isUpcoming ? (
                        <Button disabled className="w-full h-11 rounded-none bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold font-mono text-xs uppercase tracking-wider cursor-not-allowed">
                          <span>NOT OPEN YET</span>
                        </Button>
                      ) : isExpired ? (
                        <Button disabled className="w-full h-11 rounded-none bg-zinc-900 border border-zinc-800 text-zinc-600 font-bold font-mono text-xs uppercase tracking-wider cursor-not-allowed">
                          <span>EXAM WINDOW CLOSED</span>
                        </Button>
                      ) : (
                        <Link href={`/exam?testId=${test.id}`} className="block">
                          <Button className="w-full h-11 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                            <span>START TEST</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Past Attempts History Section */}
        <section id="past-attempts" className="space-y-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h2 className="text-base font-bold tracking-tight text-white uppercase font-mono">
              Past Exam Attempts
            </h2>
            <Link
              href="/history"
              className="text-xs font-mono text-zinc-400 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              <span>View Full History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto border border-zinc-800 bg-zinc-950">
            <table className="w-full text-left text-sm text-zinc-300 border-collapse font-sans">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase font-mono tracking-widest bg-zinc-900/60">
                  <th className="py-3 px-4">Test Title</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Attempted</th>
                  <th className="py-3 px-4">Correct</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
                      Loading attempt records...
                    </td>
                  </tr>
                ) : myAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono text-xs">
                      No examinations completed yet. Select an active test above to begin.
                    </td>
                  </tr>
                ) : (
                  myAttempts.slice(0, 5).map((item) => (
                    <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                      <td className="py-4 px-4 font-bold text-white">
                        {item.tests?.title || "Exam"}
                      </td>
                      <td
                        className={`py-4 px-4 font-mono font-bold ${
                          item.score > 0 ? "text-emerald-400" : item.score < 0 ? "text-rose-400" : "text-white"
                        }`}
                      >
                        {item.score > 0 ? `+${item.score}` : item.score}
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-300">
                        {item.total_attempted}
                      </td>
                      <td className="py-4 px-4 font-mono text-emerald-400">
                        {item.total_correct}
                      </td>
                      <td className="py-4 px-4 text-zinc-500 text-xs font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          onClick={() => router.push(`/results?resultId=${item.id}`)}
                          className="h-8 px-4 rounded-none bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold hover:bg-white hover:text-black uppercase tracking-wider"
                        >
                          SCORECARD
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppSidebar>
  );
}