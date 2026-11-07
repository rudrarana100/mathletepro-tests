"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  TrendingUp,
  ArrowUpDown,
  Search,
  BookOpen,
  Award,
} from "lucide-react";

interface AttemptRecord {
  id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  tests?: { title: string; duration_minutes: number };
}

type SortField = "title" | "score" | "attempted" | "correct" | "accuracy" | "date";
type SortDirection = "asc" | "desc";

function ScoreTrendChart({ data }: { data: AttemptRecord[] }) {
  const chronological = useMemo(() => {
    return [...data].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [data]);

  if (chronological.length < 2) {
    return (
      <div className="p-8 border border-zinc-800 bg-zinc-950 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest rounded-none">
        Complete at least 2 examinations to render score trajectory trends.
      </div>
    );
  }

  const width = 800;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;

  const scores = chronological.map((item) => item.score);
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(10, ...scores);
  const scoreRange = Math.max(1, maxScore - minScore);

  const getX = (idx: number) => {
    if (chronological.length === 1) return width / 2;
    return paddingX + (idx / (chronological.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (score: number) => {
    return height - paddingY - ((score - minScore) / scoreRange) * (height - 2 * paddingY);
  };

  const pointsString = chronological
    .map((item, idx) => `${getX(idx)},${getY(item.score)}`)
    .join(" ");

  return (
    <div className="p-6 border border-zinc-800 bg-zinc-950 rounded-none space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Historical Score Trajectory</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase">
          {chronological.length} Chronological Evaluations
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible font-mono text-[10px]"
        >
          {/* Horizontal Grid lines */}
          <line
            x1={paddingX}
            y1={getY(0)}
            x2={width - paddingX}
            y2={getY(0)}
            stroke="#27272a"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text x={paddingX - 10} y={getY(0) + 4} fill="#71717a" textAnchor="end">
            0
          </text>

          {maxScore > 0 && (
            <>
              <line
                x1={paddingX}
                y1={getY(maxScore)}
                x2={width - paddingX}
                y2={getY(maxScore)}
                stroke="#18181b"
                strokeWidth="1"
              />
              <text x={paddingX - 10} y={getY(maxScore) + 4} fill="#71717a" textAnchor="end">
                +{maxScore}
              </text>
            </>
          )}

          {/* Connected Polyline */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Dots and Labels */}
          {chronological.map((item, idx) => {
            const cx = getX(idx);
            const cy = getY(item.score);
            return (
              <g key={item.id} className="group cursor-pointer">
                <circle
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  className="fill-emerald-400 stroke-black stroke-2 hover:r-6 transition-all"
                />
                <text
                  x={cx}
                  y={cy - 10}
                  fill="#ffffff"
                  textAnchor="middle"
                  className="font-bold text-[9px]"
                >
                  {item.score > 0 ? `+${item.score}` : item.score}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function StudentResultsPage() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          router.push("/auth/login");
          return;
        }

        const { data, error } = await supabase
          .from("test_results")
          .select("id, test_id, score, total_attempted, total_correct, created_at, tests(title, duration_minutes)")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setAttempts(data as unknown as AttemptRecord[]);
        } else {
          setAttempts([]);
        }
      } catch {
        setAttempts([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [supabase, router]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedAndFiltered = useMemo(() => {
    const result = attempts.filter((item) => {
      const title = item.tests?.title || "Exam";
      return title.toLowerCase().includes(searchTerm.toLowerCase());
    });

    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === "title") {
        valA = a.tests?.title || "";
        valB = b.tests?.title || "";
      } else if (sortField === "score") {
        valA = a.score;
        valB = b.score;
      } else if (sortField === "attempted") {
        valA = a.total_attempted;
        valB = b.total_attempted;
      } else if (sortField === "correct") {
        valA = a.total_correct;
        valB = b.total_correct;
      } else if (sortField === "accuracy") {
        valA = a.total_attempted > 0 ? a.total_correct / a.total_attempted : 0;
        valB = b.total_attempted > 0 ? b.total_correct / b.total_attempted : 0;
      } else if (sortField === "date") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [attempts, searchTerm, sortField, sortDirection]);

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <PageHeader
        title="My Results"
        badge="STUDENT PORTAL"
        description="Complete historical transcript of examinations and score trajectory"
        breadcrumbs={[
          { label: "Mathlete Pro", href: "/student/tests" },
          { label: "My Results" },
        ]}
        action={
          <Link href="/student/tests">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider h-9"
            >
              <BookOpen className="w-3.5 h-3.5 mr-2" /> Active Tests
            </Button>
          </Link>
        }
      />

      {/* 1. Score-Trend Chart & Records */}
      {!isLoading && attempts.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No Examination Records Found"
          description="You have not participated in any examinations yet. Head over to Available Tests to initiate your first examination."
          actionLabel="EXPLORE ACTIVE TESTS"
          actionHref="/student/tests"
        />
      ) : (
        <>
          {!isLoading && <ScoreTrendChart data={attempts} />}

          {/* 2. Sortable Table of Past Attempts */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-bold uppercase tracking-tight text-white font-mono">
                Attempt Records ({sortedAndFiltered.length})
              </h2>

              {/* Quick search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by test title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 pl-9 pr-3 py-1.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 rounded-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-800 bg-zinc-950">
              <table className="w-full text-left text-sm text-zinc-300 border-collapse font-sans">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase font-mono tracking-widest bg-zinc-900/60 select-none">
                    <th
                      onClick={() => handleSort("title")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Test Title</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("score")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Score</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("attempted")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Attempted</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("correct")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Correct</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("accuracy")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Accuracy</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("date")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Scorecard</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest"
                      >
                        Loading trajectory records...
                      </td>
                    </tr>
                  ) : sortedAndFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center space-y-2">
                        <p className="text-zinc-400 font-mono text-xs">
                          {searchTerm
                            ? "No matching attempts found for this search filter."
                            : "No test records found. You haven't taken any examinations yet."}
                        </p>
                        {!searchTerm && (
                          <Link href="/student/tests">
                            <Button className="mt-2 rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider">
                              Explore Active Tests
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    sortedAndFiltered.map((item) => {
                      const acc =
                        item.total_attempted > 0
                          ? Math.round((item.total_correct / item.total_attempted) * 100)
                          : 0;

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors"
                        >
                          <td className="py-4 px-4 font-bold text-white">
                            {item.tests?.title || "Exam Series"}
                          </td>
                          <td
                            className={`py-4 px-4 font-mono font-bold ${
                              item.score > 0
                                ? "text-emerald-400"
                                : item.score < 0
                                ? "text-rose-400"
                                : "text-white"
                            }`}
                          >
                            {item.score > 0 ? `+${item.score}` : item.score}
                          </td>
                          <td className="py-4 px-4 font-mono text-zinc-300">
                            {item.total_attempted}
                          </td>
                          <td className="py-4 px-4 font-mono text-emerald-400 font-semibold">
                            {item.total_correct}
                          </td>
                          <td className="py-4 px-4 font-mono text-zinc-300">
                            {acc}%
                          </td>
                          <td className="py-4 px-4 text-zinc-500 text-xs font-mono">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Link href={`/results?resultId=${item.id}`}>
                              <Button className="h-8 px-4 rounded-none bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold hover:bg-white hover:text-black uppercase tracking-wider">
                                VIEW RESULT
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
        </>
      )}
    </div>
  );
}
