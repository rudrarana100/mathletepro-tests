"use client";

import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "@/components/MathRenderer";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Bookmark,
  HelpCircle,
  Clock,
} from "lucide-react";

interface Question {
  id: string;
  statement: string;
  options: string | string[];
  image_url?: string;
  topic?: string;
  difficulty?: string;
}

interface TestMeta {
  id: string;
  title: string;
  duration_minutes: number;
  positive_marks: number;
  negative_marks: number;
}

interface StrikeWarning {
  open: boolean;
  strikeNumber: number;
  title: string;
  message: string;
}

function ExamEngineContent() {
  const searchParams = useSearchParams();
  const testId = searchParams.get("testId");
  const router = useRouter();

  const [testMeta, setTestMeta] = useState<TestMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timer: wall-clock timestamp driven from server end_time
  const endTimeRef = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Anti-cheat strikes: strictly visibilitychange only
  const [strikes, setStrikes] = useState<number>(0);
  const [warningModal, setWarningModal] = useState<StrikeWarning | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Modals & responsive drawer
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false);

  const isSubmitting = useRef(false);

  // 1. Initial Load from Server (Answers strictly omitted by safe view / route)
  useEffect(() => {
    if (!testId) {
      setErrorMessage("No examination selected. Returning to available tests...");
      setTimeout(() => router.push("/student/tests"), 1500);
      return;
    }

    const initExam = async () => {
      try {
        setIsLoading(true);

        const res = await fetch("/api/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId }),
        });

        const data = await res.json();

        if (data.alreadyCompleted) {
          router.push(`/results?resultId=${data.resultId}`);
          return;
        }

        if (data.error || !data.questions) {
          setErrorMessage(data.error || "Failed to initialize examination");
          setIsLoading(false);
          return;
        }

        setTestMeta(data.test);
        setQuestions(data.questions);

        // Pinned server end_time
        if (data.endTime) {
          const endMs = new Date(data.endTime).getTime();
          endTimeRef.current = endMs;
          const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
          setTimeLeft(diff);
        } else if (data.remainingSeconds) {
          const endMs = Date.now() + data.remainingSeconds * 1000;
          endTimeRef.current = endMs;
          setTimeLeft(data.remainingSeconds);
        }

        // Synchronize strikes
        const serverStrikes = data.strikes || 0;
        setStrikes(serverStrikes);

        // Restore cached answers for continuity (in case of tab refresh)
        const savedAnswers = localStorage.getItem(`mathlete_answers_${testId}`);
        if (savedAnswers) {
          try {
            setAnswers(JSON.parse(savedAnswers));
          } catch {
            // ignore malformed cache
          }
        }

        const savedReview = localStorage.getItem(`mathlete_review_${testId}`);
        if (savedReview) {
          try {
            setReview(JSON.parse(savedReview));
          } catch {
            // ignore
          }
        }

        const savedIndex = localStorage.getItem(`mathlete_index_${testId}`);
        if (savedIndex) {
          const parsed = parseInt(savedIndex, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < data.questions.length) {
            setCurrentIndex(parsed);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMessage("Network error connecting to examination server.");
        setIsLoading(false);
      }
    };

    initExam();
  }, [testId, router]);

  // 2. Persist local student progress
  useEffect(() => {
    if (testId && !isLoading) {
      localStorage.setItem(`mathlete_answers_${testId}`, JSON.stringify(answers));
      localStorage.setItem(`mathlete_review_${testId}`, JSON.stringify(review));
      localStorage.setItem(`mathlete_index_${testId}`, currentIndex.toString());
    }
  }, [answers, review, currentIndex, testId, isLoading]);

  // 3. Centralized Submission Handler
  const handleSubmit = useCallback(async (reason?: string) => {
    if (isSubmitting.current || !testId) return;
    isSubmitting.current = true;
    setIsAutoSubmitting(true);
    setSubmissionError(null);

    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        attempts++;
        const res = await fetch("/api/submit-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId,
            answers,
            reason: reason || "student_submitted",
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Clear cached student state on successful submission
          localStorage.removeItem(`mathlete_answers_${testId}`);
          localStorage.removeItem(`mathlete_review_${testId}`);
          localStorage.removeItem(`mathlete_index_${testId}`);

          router.push(`/results?resultId=${data.resultId}`);
          return;
        }

        if (data.error && data.alreadyCompleted) {
          router.push(`/results?resultId=${data.resultId}`);
          return;
        }

        if (attempts >= maxRetries) {
          setSubmissionError(data.error || "Submission rejected by scoring server.");
          break;
        }
      } catch {
        if (attempts >= maxRetries) {
          setSubmissionError(
            "Network disruption: could not contact the scoring server. All selected answers remain safely stored in local memory. Click below to retry submission."
          );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }

    isSubmitting.current = false;
    setIsAutoSubmitting(false);
  }, [answers, testId, router]);

  // 4. Timer Countdown: driven by server end_time
  useEffect(() => {
    if (endTimeRef.current === null || isSubmitting.current || isLoading) return;

    const tick = () => {
      if (endTimeRef.current === null) return;
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        handleSubmit("time_expired");
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLoading, handleSubmit]);

  // 5. Anti-Cheat: VisibilityChange ONLY (no false positives on fullscreen exit)
  const triggerStrike = useCallback((reasonDesc: string) => {
    if (isSubmitting.current || isLoading || !testId) return;

    setStrikes((prevStrikes) => {
      const nextStrike = prevStrikes + 1;

      // Persist strike count on server
      fetch("/api/exam/strike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, strikes: nextStrike }),
      }).catch(console.error);

      if (nextStrike === 1) {
        setWarningModal({
          open: true,
          strikeNumber: 1,
          title: "Security notice (Strike 1 of 3)",
          message: `${reasonDesc} Navigating away from the examination window 2 more times will trigger automatic submission.`,
        });
      } else if (nextStrike === 2) {
        setWarningModal({
          open: true,
          strikeNumber: 2,
          title: "Final security warning (Strike 2 of 3)",
          message: `${reasonDesc} This is your final warning. Any further navigation outside this window will immediately submit your examination.`,
        });
      } else if (nextStrike >= 3) {
        setWarningModal({
          open: true,
          strikeNumber: 3,
          title: "Examination terminated (Strike 3 of 3)",
          message:
            "Maximum security strikes exceeded. Your responses are locked and being submitted to faculty.",
        });
        setIsAutoSubmitting(true);
        setTimeout(() => {
          handleSubmit("strike_limit_exceeded");
        }, 1200);
      }

      return nextStrike;
    });
  }, [isLoading, testId, handleSubmit]);

  useEffect(() => {
    if (isLoading || isSubmitting.current || !testId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerStrike(
          "Tab switch or window minimizing detected. Examination focus is strictly monitored."
        );
      } else {
        // When tab regains focus, immediately synchronize wall-clock time
        if (endTimeRef.current) {
          const diff = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
          setTimeLeft(diff);
          if (diff <= 0) {
            handleSubmit("time_expired");
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading, testId, triggerStrike, handleSubmit]);

  const handleSelectOption = useCallback((qId: string, optIndex: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: optIndex }));
  }, []);

  const handleClearResponse = useCallback(() => {
    if (!questions[currentIndex]) return;
    const currentQId = questions[currentIndex].id;
    setAnswers((prev) => {
      const nextAnswers = { ...prev };
      delete nextAnswers[currentQId];
      return nextAnswers;
    });
  }, [questions, currentIndex]);

  const handleMarkReview = useCallback(() => {
    if (!questions[currentIndex]) return;
    const currentQId = questions[currentIndex].id;
    setReview((prev) => ({ ...prev, [currentQId]: !prev[currentQId] }));
  }, [questions, currentIndex]);

  // Keyboard Shortcuts: [1-4] Option, [N] Next, [P] Prev, [M] Review
  useEffect(() => {
    if (isLoading || isSubmitting.current || questions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (warningModal?.open || isConfirmOpen) return;

      const key = e.key.toLowerCase();
      const currentQ = questions[currentIndex];
      if (!currentQ) return;

      if (["1", "2", "3", "4"].includes(key)) {
        e.preventDefault();
        const optIdx = parseInt(key, 10) - 1;
        handleSelectOption(currentQ.id, optIdx);
      } else if (key === "n") {
        e.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (key === "p") {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      } else if (key === "m") {
        e.preventDefault();
        handleMarkReview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, currentIndex, questions, warningModal, isConfirmOpen, handleSelectOption, handleMarkReview]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 space-y-3 font-sans">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-200 animate-spin rounded-full" />
        <div className="text-sm text-zinc-400 font-normal">
          Initializing examination session...
        </div>
      </div>
    );
  }

  if (errorMessage || questions.length === 0) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 text-red-400 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Examination notice</span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed font-normal">
            {errorMessage || "No active questions were found for this examination."}
          </p>
          <Button
            onClick={() => router.push("/student/tests")}
            className="w-full h-9 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors"
          >
            Return to available tests
          </Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  let parsedOptions: string[] = [];
  try {
    parsedOptions =
      typeof currentQ.options === "string"
        ? JSON.parse(currentQ.options)
        : Array.isArray(currentQ.options)
        ? currentQ.options
        : [];
  } catch {
    parsedOptions = [];
  }

  const minutesRemaining = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const secondsRemaining = timeLeft !== null ? timeLeft % 60 : 0;
  const isUrgentTimer = timeLeft !== null && timeLeft <= 300; // Under 5 minutes

  const answeredCount = Object.keys(answers).length;
  const reviewedCount = Object.values(review).filter(Boolean).length;
  const unattemptedCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Distraction-Free Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-zinc-950 sticky top-0 z-30">
        <div className="flex items-center gap-3 truncate">
          <div className="w-6 h-6 rounded bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center shrink-0">
            M
          </div>
          <div className="truncate">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100 truncate">
              {testMeta?.title || "Examination"}
            </h1>
            <div className="text-xs text-zinc-400 font-normal hidden sm:block">
              +{testMeta?.positive_marks ?? 4} / -{testMeta?.negative_marks ?? 1} marks per question
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {/* Strikes Counter */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
              strikes === 0
                ? "border-zinc-800 bg-zinc-900/40 text-zinc-400"
                : strikes === 1
                ? "border-yellow-500/30 bg-yellow-950/20 text-yellow-400"
                : "border-red-500/40 bg-red-950/30 text-red-400"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>
              {strikes} / 3 strikes
            </span>
          </div>

          {/* Countdown Timer (Monospace permitted) */}
          <div
            className={`font-mono tabular-nums px-3 py-1 rounded-md border text-sm font-semibold transition-colors ${
              isUrgentTimer
                ? "bg-red-950/30 border-red-500/40 text-red-400 animate-pulse"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-100"
            }`}
          >
            {timeLeft !== null
              ? `${String(minutesRemaining).padStart(2, "0")}:${String(secondsRemaining).padStart(2, "0")}`
              : "00:00"}
          </div>

          {/* Question Counter (Desktop) */}
          <div className="hidden md:block text-xs text-zinc-400 font-normal">
            Question {currentIndex + 1} of {questions.length}
          </div>

          {/* Submit Test Button */}
          <Button
            onClick={() => setIsConfirmOpen(true)}
            className="h-9 px-4 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm transition-colors"
          >
            Submit test
          </Button>
        </div>
      </header>

      {/* Main Examination Viewport */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Question Area */}
        <main className="flex flex-col flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full flex-1 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                {currentQ.topic && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-400">{currentQ.topic}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
                  className="md:hidden text-xs font-medium px-2.5 py-1 border border-zinc-800 bg-zinc-900 text-zinc-300 rounded-md"
                >
                  {isPaletteOpenMobile ? "Hide palette" : "Show palette"}
                </button>

                {review[currentQ.id] && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Marked for review
                  </span>
                )}
              </div>
            </div>

            {/* Question Statement with KaTeX Error Boundary */}
            <div className="text-lg md:text-xl font-normal leading-relaxed p-5 sm:p-6 bg-zinc-950 border border-zinc-800 rounded-lg space-y-4 shadow-sm">
              <MathRenderer content={currentQ.statement} />
              {currentQ.image_url && (
                <div className="pt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentQ.image_url}
                    alt="Question diagram"
                    className="max-h-72 max-w-full object-contain border border-zinc-800 bg-black rounded-md"
                  />
                </div>
              )}
            </div>

            {/* Options List */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {parsedOptions.map((opt: string, idx: number) => {
                const isSelected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, idx)}
                    className={`p-4 text-left border rounded-lg transition-colors flex items-start gap-3.5 ${
                      isSelected
                        ? "border-zinc-200 bg-zinc-900/80 text-zinc-100 shadow-sm"
                        : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/40"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium shrink-0 border ${
                        isSelected
                          ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="text-sm sm:text-base text-zinc-200 pt-0.5 leading-relaxed flex-1">
                      <MathRenderer content={opt} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Bar */}
          <div className="max-w-4xl mx-auto w-full pt-8 flex flex-wrap gap-2.5 sm:gap-3 mt-auto">
            <Button
              type="button"
              onClick={handleMarkReview}
              variant="outline"
              className={`flex-1 rounded-md text-sm font-medium h-10 border ${
                review[currentQ.id]
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20"
                  : "bg-transparent text-zinc-300 border-zinc-800 hover:bg-zinc-900"
              }`}
            >
              {review[currentQ.id] ? "Unmark review" : "Mark for review"}
            </Button>

            <Button
              type="button"
              onClick={handleClearResponse}
              variant="outline"
              className="flex-1 rounded-md bg-transparent border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-sm font-medium h-10"
            >
              Clear response
            </Button>

            <Button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              variant="outline"
              className="rounded-md border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 text-sm font-medium h-10 px-4"
            >
              Previous
            </Button>

            {currentIndex === questions.length - 1 ? (
              <Button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="flex-[2] rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-sm font-medium h-10 transition-colors"
              >
                Review & submit
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className="flex-[2] rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium h-10 transition-colors"
              >
                Save & next
              </Button>
            )}
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="max-w-4xl mx-auto w-full pt-3 hidden sm:flex items-center justify-between text-xs text-zinc-500 font-normal">
            <div className="flex items-center gap-3">
              <span><kbd className="text-zinc-400 border border-zinc-800 px-1 py-0.5 rounded bg-zinc-900">1-4</kbd> Select option</span>
              <span><kbd className="text-zinc-400 border border-zinc-800 px-1 py-0.5 rounded bg-zinc-900">N</kbd> Next</span>
              <span><kbd className="text-zinc-400 border border-zinc-800 px-1 py-0.5 rounded bg-zinc-900">P</kbd> Previous</span>
              <span><kbd className="text-zinc-400 border border-zinc-800 px-1 py-0.5 rounded bg-zinc-900">M</kbd> Mark review</span>
            </div>
            <span>Distraction-free proctored mode</span>
          </div>
        </main>

        {/* Sidebar Question Palette */}
        <aside
          className={`w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 p-6 flex-col shrink-0 ${
            isPaletteOpenMobile ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400 mb-4">
            <span>Question palette</span>
            <span className="font-mono tabular-nums text-zinc-200">{currentIndex + 1} / {questions.length}</span>
          </div>

          <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-64 md:max-h-[calc(100vh-280px)] pb-4">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isReviewed = review[q.id];
              const isCurrent = idx === currentIndex;

              let tileClass = "border-zinc-800 text-zinc-400 bg-black hover:border-zinc-700";
              if (isCurrent) {
                tileClass = "border-zinc-100 text-zinc-100 bg-zinc-800 ring-1 ring-zinc-200 font-semibold";
              } else if (isAnswered && isReviewed) {
                tileClass = "border-yellow-500/50 bg-yellow-950/30 text-yellow-400 font-medium";
              } else if (isAnswered) {
                tileClass = "border-emerald-500/50 bg-emerald-950/30 text-emerald-400 font-medium";
              } else if (isReviewed) {
                tileClass = "border-yellow-500/40 border-dashed text-yellow-400 bg-black font-normal";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setIsPaletteOpenMobile(false);
                  }}
                  className={`h-9 text-xs font-mono tabular-nums border rounded-md transition-colors ${tileClass}`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="mt-auto space-y-2 pt-5 border-t border-zinc-900 text-xs font-normal text-zinc-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm border border-emerald-500/50 bg-emerald-950/30" />
                <span>Answered</span>
              </div>
              <span className="font-mono tabular-nums text-zinc-200">{answeredCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm border border-yellow-500/50 border-dashed bg-black" />
                <span>Marked for review</span>
              </div>
              <span className="font-mono tabular-nums text-yellow-400">{reviewedCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm border border-zinc-800 bg-black" />
                <span>Unattempted</span>
              </div>
              <span className="font-mono tabular-nums text-zinc-400">{unattemptedCount}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm Submit Dialog */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-1 border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                Submit examination
              </h2>
              <p className="text-sm text-zinc-400 font-normal">
                Review your response status before finalizing submission
              </p>
            </div>

            {/* Counts Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-md bg-zinc-900/60 border border-emerald-500/20">
                <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-medium mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Answered
                </div>
                <div className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{answeredCount}</div>
              </div>

              <div className="p-3 rounded-md bg-zinc-900/60 border border-yellow-500/20">
                <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs font-medium mb-1">
                  <Bookmark className="w-3.5 h-3.5" /> Marked
                </div>
                <div className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{reviewedCount}</div>
              </div>

              <div className="p-3 rounded-md bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs font-medium mb-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Skipped
                </div>
                <div className="text-xl font-semibold text-zinc-100 font-mono tabular-nums">{unattemptedCount}</div>
              </div>
            </div>

            <div className="p-3 rounded-md border border-zinc-900 bg-zinc-900/30 text-xs text-zinc-400 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>
                Time remaining: <strong className="text-zinc-200 font-mono tabular-nums">{minutesRemaining}m {secondsRemaining}s</strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 rounded-md border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 text-sm font-medium h-9"
              >
                Keep attempting
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit("student_confirmed")}
                className="flex-1 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium h-9 transition-colors"
              >
                Confirm & submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Visibility Change Anti-Cheat Strike Warning Dialog */}
      {warningModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-red-500/40 rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-semibold tracking-tight">
                {warningModal.title}
              </h2>
            </div>

            <p className="text-zinc-300 text-sm leading-relaxed font-normal">
              {warningModal.message}
            </p>

            <div className="pt-2">
              {warningModal.strikeNumber < 3 ? (
                <Button
                  onClick={() => setWarningModal(null)}
                  className="w-full rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-medium h-9 transition-colors"
                >
                  I understand — return to examination
                </Button>
              ) : (
                <div className="text-center text-xs text-red-400 font-medium">
                  Submitting responses...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submitting Overlay */}
      {isAutoSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 space-y-3 animate-in fade-in duration-150 font-sans">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-100 animate-spin rounded-full" />
          <h2 className="text-base font-semibold tracking-tight text-zinc-100">
            Submitting examination
          </h2>
          <p className="text-xs text-zinc-400 font-normal text-center">
            Finalizing and evaluating responses on the scoring server...
          </p>
        </div>
      )}

      {/* Network Disruption Retry Modal */}
      {submissionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150 font-sans">
          <div className="bg-zinc-950 border border-red-500/40 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold tracking-tight">
                Network disruption
              </h3>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed font-normal">
              {submissionError}
            </p>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 text-xs text-emerald-400 rounded-md">
              ✓ All selected responses remain safely preserved in local memory.
            </div>
            <Button
              type="button"
              onClick={() => handleSubmit("manual_retry")}
              className="w-full rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium h-9 transition-colors"
            >
              Retry submission now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black text-zinc-400 text-sm font-normal font-sans">
          Loading examination engine...
        </div>
      }
    >
      <ExamEngineContent />
    </Suspense>
  );
}