"use client";

import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";
import { AlertTriangle, ShieldAlert, CheckCircle2, Bookmark, HelpCircle, Clock, Maximize2 } from "lucide-react";

interface Question {
  id: string;
  statement: string;
  options: string;
  image_url?: string;
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Anti-cheat Strike System & Fullscreen Enforcement
  const [strikes, setStrikes] = useState<number>(0);
  const [warningModal, setWarningModal] = useState<StrikeWarning | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Confirm Submit Dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false);

  const isSubmitting = useRef(false);

  // 1. Initial Load from Server (Answers & Solutions strictly omitted!)
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
          alert("Notice: You have already completed this examination.");
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

        // Synchronize strikes
        const savedStrikes = localStorage.getItem(`strikes_${testId}`);
        const currentStrikeCount = savedStrikes
          ? Math.max(parseInt(savedStrikes, 10), data.strikes || 0)
          : data.strikes || 0;
        setStrikes(currentStrikeCount);

        // Recover saved answers and review state
        const savedAnswers = localStorage.getItem(`answers_${testId}`);
        if (savedAnswers) {
          try {
            setAnswers(JSON.parse(savedAnswers));
          } catch (e) {
            console.error("Failed to parse cached answers", e);
          }
        }

        const savedReview = localStorage.getItem(`review_${testId}`);
        if (savedReview) {
          try {
            setReview(JSON.parse(savedReview));
          } catch (e) {
            console.error("Failed to parse cached review tags", e);
          }
        }

        // Recover current question index
        const savedIndex = localStorage.getItem(`currentIndex_${testId}`);
        if (savedIndex) {
          try {
            const parsedIdx = parseInt(savedIndex, 10);
            if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < data.questions.length) {
              setCurrentIndex(parsedIdx);
            }
          } catch {
            // ignore
          }
        }

        // Initialize timer from server remainingSeconds
        const serverRemaining = data.remainingSeconds;
        const localSavedTime = localStorage.getItem(`time_${testId}`);
        if (localSavedTime) {
          const parsedLocal = parseInt(localSavedTime, 10);
          setTimeLeft(Math.min(parsedLocal, serverRemaining));
        } else {
          setTimeLeft(serverRemaining);
        }

        // Check if browser is currently fullscreen
        const inFs = Boolean(
          typeof document !== "undefined" &&
            (document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement)
        );
        setIsFullscreen(inFs);
        if (!inFs) {
          setShowFullscreenPrompt(true);
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

  // 2. Save Progress to localStorage on change
  useEffect(() => {
    if (testId && !isLoading) {
      localStorage.setItem(`answers_${testId}`, JSON.stringify(answers));
      localStorage.setItem(`review_${testId}`, JSON.stringify(review));
      localStorage.setItem(`currentIndex_${testId}`, currentIndex.toString());
    }
  }, [answers, review, currentIndex, testId, isLoading]);

  // Fullscreen Request & Safe Exit Handlers
  const requestFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    } catch (err) {
      console.warn("Fullscreen permission or gesture rejected:", err);
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    }
  }, []);

  const exitFullscreenSafe = useCallback(() => {
    try {
      if (
        typeof document !== "undefined" &&
        (document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement)
      ) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
          (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 3. Exam Submit Handler with Exponential Retry & Zero Data Loss Guarantee
  const handleSubmit = useCallback(async (reason?: string) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setIsConfirmOpen(false);
    setSubmissionError(null);

    if (reason === "time_expired" || reason === "strike_limit_exceeded") {
      setIsAutoSubmitting(true);
    }

    const submitWithRetry = async (attempt = 1, maxAttempts = 3): Promise<any> => {
      try {
        const res = await fetch("/api/submit-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId, answers }),
        });
        const data = await res.json();
        return data;
      } catch (err) {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 500; // 1000ms, 2000ms
          await new Promise((r) => setTimeout(r, delay));
          return submitWithRetry(attempt + 1, maxAttempts);
        }
        throw err;
      }
    };

    try {
      if (reason === "strike_limit_exceeded") {
        console.warn("Auto-submitting due to anti-cheat violation (Strike 3)");
      }

      const data = await submitWithRetry();

      if (data.error || !data.resultId) {
        if (data.alreadyCompleted && data.resultId) {
          exitFullscreenSafe();
          router.push(`/results?resultId=${data.resultId}`);
          return;
        }
        setSubmissionError(data.error || "Evaluation failed on scoring server.");
        isSubmitting.current = false;
        setIsAutoSubmitting(false);
        return;
      }

      // Cache the result in localStorage so the scorecard and history reflect immediately
      try {
        const newRecord = {
          id: data.resultId,
          test_id: testId,
          score: data.score,
          total_attempted: data.totalAttempted,
          total_correct: data.totalCorrect,
          created_at: new Date().toISOString(),
          tests: { title: testMeta?.title || "Examination" },
          answers: answers,
          answers_data: answers,
        };
        const prev = JSON.parse(localStorage.getItem("mathlete_local_results") || "[]");
        localStorage.setItem("mathlete_local_results", JSON.stringify([newRecord, ...prev]));
        localStorage.setItem(`mathlete_result_${data.resultId}`, JSON.stringify(newRecord));
      } catch {
        // ignore
      }

      // Cleanup local exam cache
      localStorage.removeItem(`answers_${testId}`);
      localStorage.removeItem(`review_${testId}`);
      localStorage.removeItem(`time_${testId}`);
      localStorage.removeItem(`strikes_${testId}`);
      localStorage.removeItem(`currentIndex_${testId}`);
      localStorage.removeItem(`mathlete_exam_${testId}`);

      exitFullscreenSafe();
      router.push(`/results?resultId=${data.resultId}`);
    } catch {
      setSubmissionError(
        "Network Disruption: Could not connect to the scoring server after multiple attempts. All your selected answers remain safely preserved in local storage."
      );
      isSubmitting.current = false;
      setIsAutoSubmitting(false);
    }
  }, [answers, testId, router, testMeta?.title, exitFullscreenSafe]);

  // 4. Timer Countdown (Non-blocking Auto-submit on zero)
  useEffect(() => {
    if (timeLeft === null || isSubmitting.current || isLoading) return;

    if (timeLeft <= 0) {
      setIsAutoSubmitting(true);
      handleSubmit("time_expired");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev !== null && prev > 0 ? prev - 1 : 0;
        if (testId) localStorage.setItem(`time_${testId}`, newTime.toString());
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, testId, handleSubmit, isLoading]);

  // 5. Centralized Anti-Cheat Strike Handler
  const triggerStrike = useCallback((reasonDesc: string) => {
    if (isSubmitting.current || isLoading || !testId) return;

    setStrikes((prevStrikes) => {
      const nextStrike = prevStrikes + 1;
      localStorage.setItem(`strikes_${testId}`, nextStrike.toString());

      // Persist strike count on the server
      fetch("/api/exam/strike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, strikes: nextStrike }),
      }).catch(console.error);

      if (nextStrike === 1) {
        setWarningModal({
          open: true,
          strikeNumber: 1,
          title: "Security Warning (Strike 1 of 3)",
          message: `${reasonDesc} Navigating away 2 more times will trigger automatic submission.`,
        });
      } else if (nextStrike === 2) {
        setWarningModal({
          open: true,
          strikeNumber: 2,
          title: "FINAL SECURITY WARNING (Strike 2 of 3)",
          message: `${reasonDesc} This is your final warning. Any further navigation outside this examination window will immediately auto-submit your test.`,
        });
      } else if (nextStrike >= 3) {
        setWarningModal({
          open: true,
          strikeNumber: 3,
          title: "Examination Terminated (Strike 3 of 3)",
          message:
            "Maximum anti-cheat strikes exceeded. Your responses are being locked and automatically submitted to faculty.",
        });
        setIsAutoSubmitting(true);
        setTimeout(() => {
          handleSubmit("strike_limit_exceeded");
        }, 1200);
      }

      return nextStrike;
    });
  }, [isLoading, testId, handleSubmit]);

  // 6. Proctored Fullscreen Monitor
  useEffect(() => {
    if (isLoading || isSubmitting.current) return;

    const handleFsChange = () => {
      const inFs = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(inFs);
      if (!inFs && !isSubmitting.current && !showFullscreenPrompt) {
        triggerStrike("Fullscreen exit detected. You must remain in full-screen proctored mode during the examination.");
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, [isLoading, showFullscreenPrompt, triggerStrike]);

  // 7. Tab switch & window minimize monitor
  useEffect(() => {
    if (isLoading || isSubmitting.current || !testId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerStrike("Tab switch or window minimizing was detected. Mathematical examination integrity is strictly enforced.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading, testId, triggerStrike]);

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

  // 6. Keyboard Shortcuts: [1-4] Select, [N] Next, [P] Prev, [M] Review
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
      <div className="flex flex-col h-screen items-center justify-center bg-black text-white space-y-4">
        <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin rounded-none" />
        <div className="font-mono text-xs uppercase tracking-widest text-zinc-400">
          Initializing Secure Examination Engine...
        </div>
      </div>
    );
  }

  if (errorMessage || questions.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-black text-white p-6">
        <Card className="max-w-md w-full bg-zinc-950 border-zinc-800 rounded-none p-6 space-y-6">
          <div className="flex items-center gap-3 text-red-500 font-mono text-sm font-bold uppercase tracking-wider">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Examination Alert</span>
          </div>
          <p className="text-zinc-400 text-sm font-sans leading-relaxed">
            {errorMessage || "No active questions were found for this examination."}
          </p>
          <Button
            onClick={() => router.push("/student/tests")}
            className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider"
          >
            Return to Available Tests
          </Button>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  let parsedOptions: string[] = [];
  try {
    parsedOptions = typeof currentQ.options === "string" ? JSON.parse(currentQ.options) : currentQ.options;
  } catch {
    parsedOptions = [];
  }

  const minutesRemaining = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const isUrgentTimer = timeLeft !== null && timeLeft <= 300; // Under 5 minutes

  // Calculated Status Counts for Confirm-Submit Dialog
  const answeredCount = Object.keys(answers).length;
  const reviewedCount = Object.values(review).filter(Boolean).length;
  const unattemptedCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Sticky Header with Timer */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 sm:px-6 bg-zinc-950 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="font-bold tracking-tight text-white uppercase text-sm font-mono truncate max-w-[200px] sm:max-w-none">
            {testMeta?.title || "Mathlete Pro Gym"}
          </div>
          <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-4 text-xs font-mono text-zinc-400">
            <span>+{testMeta?.positive_marks ?? 4} / -{testMeta?.negative_marks ?? 1} Marks</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 text-sm font-medium">
          {/* Anti-cheat Strike Counter */}
          <div className="flex items-center gap-1.5 sm:gap-2 border border-zinc-800 bg-black px-2.5 sm:px-3 py-1.5 rounded-none font-mono text-xs">
            <span className="text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">
              STRIKES:
            </span>
            <span
              className={`font-bold ${
                strikes === 0
                  ? "text-zinc-400"
                  : strikes === 1
                  ? "text-yellow-400"
                  : "text-red-500 animate-pulse"
              }`}
            >
              {strikes} / 3
            </span>
          </div>

          {/* Countdown Timer (Turns Red under 5 mins) */}
          <div
            className={`font-mono px-3 sm:px-4 py-1.5 rounded-none border text-base font-bold transition-colors ${
              isUrgentTimer
                ? "bg-red-950/40 border-red-800 text-red-400 animate-pulse"
                : "bg-zinc-900 border-zinc-800 text-white"
            }`}
          >
            {timeLeft !== null
              ? `${String(minutesRemaining).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`
              : "00:00"}
          </div>

          {/* Submit Exam Button */}
          <Button
            onClick={() => setIsConfirmOpen(true)}
            variant="destructive"
            className="rounded-none font-bold font-mono text-xs uppercase tracking-wider px-3 sm:px-6 h-9"
          >
            SUBMIT EXAM
          </Button>
        </div>
      </header>

      {/* Main Examination Viewport */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Question Area */}
        <div className="flex flex-col flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full flex-1 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2 sm:gap-3 text-zinc-500 font-bold text-xs tracking-widest uppercase font-mono">
                <span>QUESTION {currentIndex + 1} OF {questions.length}</span>
                <span className="text-zinc-700 hidden sm:inline">•</span>
                <span className="text-zinc-400 hidden sm:inline">Single Choice</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
                  className="md:hidden text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-1 border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  {isPaletteOpenMobile ? "Hide Palette" : "Show Palette"}
                </button>

                {review[currentQ.id] && (
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                    Review
                  </span>
                )}
              </div>
            </div>

            {/* Statement */}
            <div className="text-xl md:text-2xl font-medium leading-relaxed p-4 sm:p-6 bg-zinc-950 border border-zinc-800 rounded-none space-y-4">
              <Latex>{currentQ.statement}</Latex>
              {currentQ.image_url && (
                <div className="pt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentQ.image_url}
                    alt="Question Diagram"
                    className="max-h-72 max-w-full object-contain border border-zinc-800 bg-black"
                  />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {parsedOptions.map((opt: string, idx: number) => {
                const isSelected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, idx)}
                    className={`p-4 md:p-5 text-left border rounded-none transition-all duration-150 flex items-start gap-4 ${
                      isSelected
                        ? "border-white bg-zinc-900 text-white shadow-inner"
                        : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 flex items-center justify-center font-mono text-xs font-bold shrink-0 border ${
                        isSelected
                          ? "border-white bg-white text-black"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="text-base text-zinc-100 pt-0.5 leading-relaxed">
                      <Latex>{opt}</Latex>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="max-w-4xl mx-auto w-full pt-8 flex flex-wrap gap-2.5 sm:gap-3 mt-auto">
            <Button
              type="button"
              onClick={handleMarkReview}
              className={`flex-1 rounded-none font-bold font-mono text-xs tracking-wider uppercase h-11 border ${
                review[currentQ.id]
                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30"
                  : "bg-transparent text-zinc-300 border-zinc-800 hover:bg-zinc-900"
              }`}
            >
              {review[currentQ.id] ? "UNMARK REVIEW" : "MARK FOR REVIEW"}
            </Button>

            <Button
              type="button"
              onClick={handleClearResponse}
              className="flex-1 rounded-none bg-transparent border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold font-mono text-xs tracking-wider uppercase h-11"
            >
              CLEAR RESPONSE
            </Button>

            <Button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              variant="outline"
              className="rounded-none border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 font-mono text-xs font-bold uppercase h-11 px-4"
            >
              PREVIOUS
            </Button>

            {currentIndex === questions.length - 1 ? (
              <Button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="flex-[2] rounded-none bg-emerald-500 text-black hover:bg-emerald-400 font-bold font-mono text-xs tracking-wider uppercase h-11"
              >
                REVIEW & SUBMIT
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className="flex-[2] rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs tracking-wider uppercase h-11"
              >
                SAVE & NEXT
              </Button>
            )}
          </div>

          {/* Keyboard Shortcuts Hint Bar */}
          <div className="max-w-4xl mx-auto w-full pt-3 hidden sm:flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-3">
              <span><kbd className="text-zinc-300 border border-zinc-800 px-1 py-0.5 bg-zinc-950">1-4</kbd> Select Option</span>
              <span><kbd className="text-zinc-300 border border-zinc-800 px-1 py-0.5 bg-zinc-950">N</kbd> Next</span>
              <span><kbd className="text-zinc-300 border border-zinc-800 px-1 py-0.5 bg-zinc-950">P</kbd> Prev</span>
              <span><kbd className="text-zinc-300 border border-zinc-800 px-1 py-0.5 bg-zinc-950">M</kbd> Mark Review</span>
            </div>
            <span>Mathlete Pro Gym v2</span>
          </div>
        </div>

        {/* Sidebar Question Palette */}
        <aside className={`w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 p-6 flex-col shrink-0 ${isPaletteOpenMobile ? "flex" : "hidden md:flex"}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500 font-mono mb-4">
            <span>Question Palette</span>
            <span className="text-white font-mono">{currentIndex + 1} / {questions.length}</span>
          </div>

          <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-64 md:max-h-[calc(100vh-280px)] pb-4">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isReviewed = review[q.id];
              const isCurrent = idx === currentIndex;

              // Clear visual state for each palette tile:
              let tileClass = "border-zinc-800 text-zinc-500 bg-black hover:border-zinc-600";
              if (isCurrent) {
                tileClass = "border-white text-white bg-zinc-900 ring-2 ring-white font-black";
              } else if (isAnswered && isReviewed) {
                tileClass = "border-yellow-500 bg-yellow-950/40 text-yellow-400 font-bold";
              } else if (isAnswered) {
                tileClass = "border-emerald-500 bg-emerald-950/40 text-emerald-400 font-bold";
              } else if (isReviewed) {
                tileClass = "border-yellow-500 border-dashed text-yellow-400 bg-black font-medium";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 text-xs font-bold font-mono border rounded-none transition-all ${tileClass}`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="mt-auto space-y-2 pt-6 border-t border-zinc-900 text-xs font-medium text-zinc-400 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 border border-emerald-500 bg-emerald-950/40" />
                <span>Answered</span>
              </div>
              <span className="font-bold text-white">{answeredCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 border border-yellow-500 border-dashed bg-black" />
                <span>Marked for Review</span>
              </div>
              <span className="font-bold text-yellow-400">{reviewedCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 border border-zinc-800 bg-black" />
                <span>Unattempted</span>
              </div>
              <span className="font-bold text-zinc-500">{unattemptedCount}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm-Submit Modal Dialog */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-none max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="space-y-1 border-b border-zinc-800 pb-4">
              <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-white">
                Submit Examination
              </h2>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider">
                Review your completion status before final evaluation
              </p>
            </div>

            {/* Counts Breakdown Grid */}
            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              <div className="p-3 bg-zinc-900/60 border border-emerald-950/60">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[11px] uppercase font-bold mb-1">
                  <CheckCircle2 className="w-3 h-3" /> Answered
                </div>
                <div className="text-2xl font-black text-white">{answeredCount}</div>
              </div>

              <div className="p-3 bg-zinc-900/60 border border-yellow-950/60">
                <div className="flex items-center justify-center gap-1.5 text-yellow-400 text-[11px] uppercase font-bold mb-1">
                  <Bookmark className="w-3 h-3" /> Marked
                </div>
                <div className="text-2xl font-black text-white">{reviewedCount}</div>
              </div>

              <div className="p-3 bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[11px] uppercase font-bold mb-1">
                  <HelpCircle className="w-3 h-3" /> Skipped
                </div>
                <div className="text-2xl font-black text-white">{unattemptedCount}</div>
              </div>
            </div>

            <div className="p-3.5 border border-zinc-900 bg-black text-xs font-mono text-zinc-400 flex items-center gap-3">
              <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>
                Remaining Timer: <strong className="text-white">{timeLeft !== null ? `${minutesRemaining}m ${timeLeft % 60}s` : "00:00"}</strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 rounded-none border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider h-11"
              >
                Keep Attempting
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit("student_confirmed")}
                className="flex-1 rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-11"
              >
                Confirm & Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-cheat Strike Warning Dialog */}
      {warningModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border-2 border-red-500/80 rounded-none max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert className="w-8 h-8 shrink-0 animate-pulse" />
              <h2 className="font-mono text-base md:text-lg font-bold uppercase tracking-tight">
                {warningModal.title}
              </h2>
            </div>

            <p className="text-zinc-300 text-sm leading-relaxed font-sans">
              {warningModal.message}
            </p>

            <div className="pt-2">
              {warningModal.strikeNumber < 3 ? (
                <Button
                  onClick={() => {
                    setWarningModal(null);
                    requestFullscreen();
                  }}
                  className="w-full rounded-none bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider h-11"
                >
                  I UNDERSTAND — RETURN TO TEST
                </Button>
              ) : (
                <div className="text-center font-mono text-xs text-red-400 uppercase tracking-widest animate-pulse font-bold">
                  Submitting responses...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proctored Fullscreen Request Modal */}
      {(showFullscreenPrompt || (!isFullscreen && !isLoading && !errorMessage && !isSubmitting.current)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-none max-w-md w-full p-6 md:p-8 space-y-6 shadow-2xl text-center">
            <div className="inline-flex p-3 bg-zinc-900 border border-zinc-800 text-white mx-auto">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono text-lg font-bold uppercase tracking-tight text-white">
                Fullscreen Required
              </h2>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider">
                Proctored Examination Mode
              </p>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed font-sans text-left">
              This examination requires full-screen enforcement. Window defocus, tab navigation, and fullscreen exits are strictly tracked. Exceeding 3 security strikes will automatically submit your attempt.
            </p>
            <Button
              type="button"
              onClick={requestFullscreen}
              className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-11 flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>ENTER FULLSCREEN & BEGIN</span>
            </Button>
          </div>
        </div>
      )}

      {/* Auto-Submitting / Zero-Timer Lockout Overlay */}
      {isAutoSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 space-y-4 animate-in fade-in duration-150">
          <div className="w-10 h-10 border-2 border-white border-t-transparent animate-spin rounded-none" />
          <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
            Time Expired / Security Lockout
          </h2>
          <p className="font-mono text-xs text-zinc-400 uppercase tracking-widest text-center">
            Finalizing and atomically submitting examination responses to the scoring server...
          </p>
        </div>
      )}

      {/* Submission Network Disruption Retry Modal */}
      {submissionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-red-500/80 rounded-none max-w-md w-full p-6 md:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-tight">
                Submission Network Disruption
              </h3>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed font-mono">
              {submissionError}
            </p>
            <div className="p-3 bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-emerald-400">
              ✓ All selected answers and timestamps remain safely preserved in local cache.
            </div>
            <Button
              type="button"
              onClick={() => handleSubmit("manual_retry")}
              className="w-full rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-11"
            >
              RETRY SUBMISSION NOW
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
        <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-xs uppercase tracking-widest">
          Loading Examination Engine...
        </div>
      }
    >
      <ExamEngineContent />
    </Suspense>
  );
}