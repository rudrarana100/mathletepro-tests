"use client";

import { useState, useMemo } from "react";
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

export interface StudentResultRow {
  id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  rank?: number | null;
  tests?: {
    title: string;
    duration_minutes: number;
    positive_marks?: number;
    questions?: Array<{ id: string }>;
  } | null;
}

type SortField = "date" | "title" | "score" | "accuracy" | "rank";
type SortDirection = "asc" | "desc";

function ScoreTrendChart({ data }: { data: StudentResultRow[] }) {
  const chronological = useMemo(() => {
    return [...data].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [data]);

  if (chronological.length < 2) {
    return (
      <div className="p-8 border border-zinc-800 bg-zinc-950 text-center text-xs text-zinc-500 rounded-lg">
        Complete at least 2 tests to view your score trajectory.
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
    <div className="p-6 border border-zinc-800 bg-zinc-950 rounded-lg space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Score trajectory</span>
        </div>
        <span className="text-xs text-zinc-500 tabular-nums">
          {chronological.length} evaluations
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible text-[10px]"
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
          <text x={paddingX - 10} y={getY(0) + 4} fill="#71717a" textAnchor="end" className="tabular-nums">
            0
          </text>

          {/* Connected Polyline */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
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
                  r="4"
                  className="fill-emerald-400 stroke-zinc-950 stroke-2 hover:r-5 transition-all"
                />
                <text
                  x={cx}
                  y={cy - 10}
                  fill="#ffffff"
                  textAnchor="middle"
                  className="font-medium text-[10px] tabular-nums"
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

export default function StudentResultsView({
  initialAttempts,
}: {
  initialAttempts: StudentResultRow[];
}) {
  const [attempts] = useState<StudentResultRow[]>(initialAttempts);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Section C.3: Format dates as "7 Nov 2026"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Section D.3: Format score as "score / total marks (percentage)"
  const formatScoreWithMax = (score: number, maxMarks: number) => {
    if (maxMarks <= 0) return `${score}`;
    const pct = Math.round((score / maxMarks) * 100);
    return `${score} / ${maxMarks} (${pct}%)`;
  };

  const sortedAndFiltered = useMemo(() => {
    const result = attempts.filter((item) => {
      const title = item.tests?.title || "Exam";
      return title.toLowerCase().includes(searchTerm.toLowerCase());
    });

    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === "date") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortField === "title") {
        valA = (a.tests?.title || "").toLowerCase();
        valB = (b.tests?.title || "").toLowerCase();
      } else if (sortField === "score") {
        valA = a.score;
        valB = b.score;
      } else if (sortField === "accuracy") {
        valA = a.total_attempted > 0 ? a.total_correct / a.total_attempted : 0;
        valB = b.total_attempted > 0 ? b.total_correct / b.total_attempted : 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [attempts, searchTerm, sortField, sortDirection]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="My Results"
        description="Comprehensive evaluation scorecards, ranking and solutions"
        breadcrumbs={[
          { label: "Mathlete Pro", href: "/student/tests" },
          { label: "My Results" },
        ]}
      />

      {/* Trajectory visualization */}
      {attempts.length > 0 && <ScoreTrendChart data={attempts} />}

      {/* Filter and Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by exam title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="text-xs text-zinc-500 tabular-nums">
            Showing {sortedAndFiltered.length} of {attempts.length} evaluations
          </div>
        </div>

        {attempts.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No evaluations found"
            description="You have not completed any examinations yet. Check the Available Tests tab to begin."
            actionLabel="Available tests"
            actionHref="/student/tests"
          />
        ) : (
          <div className="overflow-x-auto border border-zinc-800 bg-zinc-950 rounded-lg">
            <table className="w-full text-left text-sm text-zinc-300 border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-medium bg-zinc-900/40">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 font-medium"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Test title</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 font-medium"
                    onClick={() => handleSort("score")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Score</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 font-medium"
                    onClick={() => handleSort("accuracy")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Accuracy</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 font-medium"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right font-medium">Scorecard</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFiltered.map((item) => {
                  const accuracy =
                    item.total_attempted > 0
                      ? Math.round((item.total_correct / item.total_attempted) * 100)
                      : 0;
                  const testMax =
                    (item.tests?.questions?.length ?? 0) * (item.tests?.positive_marks ?? 4);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-zinc-100">
                        {item.tests?.title || "Exam"}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-semibold text-emerald-400">
                        {formatScoreWithMax(item.score, testMax)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-zinc-300">
                        <span className="text-zinc-100">{accuracy}%</span>
                        <span className="text-xs text-zinc-500 ml-1.5">
                          ({item.total_correct}/{item.total_attempted})
                        </span>
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
                            <Award className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                            <span>View</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
