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
  Maximize2,
  Minimize2,
  Info,
  Check,
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
  max_strikes?: number;
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

  // Lifecycle Phase: "loading" | "instructions" | "active"
  const [examPhase, setExamPhase] = useState<"loading" | "instructions" | "active">("loading");
  const [isResumed, setIsResumed] = useState(false);
  const [resumeMinutes, setResumeMinutes] = useState(0);

  const [testMeta, setTestMeta] = useState<TestMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fullscreen state & immunity window
  const [isFullscreen, setIsFullscreen] = useState(true);
  const lastFullscreenChangeRef = useRef<number>(0);

  // Monotonic Timer: performance.now() driven, zero drift
  const initialRemainingSecondsRef = useRef<number>(0);
  const startPerformanceNowRef = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Anti-cheat strikes: strictly visibilitychange only
  const [strikes, setStrikes] = useState<number>(0);
  const lastHiddenTimeRef = useRef<number>(0);
  const pendingStrikeRef = useRef<boolean>(false);
  const [warningModal, setWarningModal] = useState<StrikeWarning | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Modals & responsive drawer
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState(false);

  const isSubmitting = useRef(false);

  // Fullscreen helpers (synchronous, cross-browser webkit/moz/ms fallbacks, never blocks exam)
  const requestFullscreenSync = useCallback(() => {
    try {
      lastFullscreenChangeRef.current = performance.now();
      const doc = document as any;
      const inFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!inFs) {
        const docEl = document.documentElement as any;
        if (typeof docEl.requestFullscreen === "function") {
          docEl.requestFullscreen().catch(() => {});
        } else if (typeof docEl.webkitRequestFullscreen === "function") {
          docEl.webkitRequestFullscreen();
        } else if (typeof docEl.mozRequestFullScreen === "function") {
          docEl.mozRequestFullScreen();
        } else if (typeof docEl.msRequestFullscreen === "function") {
          docEl.msRequestFullscreen();
        }
      }
    } catch {
      // Browser refused or unsupported (e.g. iOS Safari) - never block or strike
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      lastFullscreenChangeRef.current = performance.now();
      const doc = document as any;
      const docEl = document.documentElement as any;
      const inFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!inFs) {
        if (typeof docEl.requestFullscreen === "function") {
          docEl.requestFullscreen().catch(() => {});
        } else if (typeof docEl.webkitRequestFullscreen === "function") {
          docEl.webkitRequestFullscreen();
        } else if (typeof docEl.mozRequestFullScreen === "function") {
          docEl.mozRequestFullScreen();
        } else if (typeof docEl.msRequestFullscreen === "function") {
          docEl.msRequestFullscreen();
        }
      } else {
        if (typeof doc.exitFullscreen === "function") {
          doc.exitFullscreen().catch(() => {});
        } else if (typeof doc.webkitExitFullscreen === "function") {
          doc.webkitExitFullscreen();
        } else if (typeof doc.mozCancelFullScreen === "function") {
          doc.mozCancelFullScreen();
        } else if (typeof doc.msExitFullscreen === "function") {
          doc.msExitFullscreen();
        }
      }
    } catch {
      // Silently ignore
    }
  }, []);

  // Listen to fullscreen changes to update non-blocking banner and immune window
  useEffect(() => {
    const handleFullscreenChange = () => {
      lastFullscreenChangeRef.current = performance.now();
      const inFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(inFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Centralized Submission Handler
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
          localStorage.removeItem(`mathlete_strikes_${testId}`);

          const reasonParam = reason === "strike_limit_exceeded" ? "&reason=strike_limit_exceeded" : "";
          router.push(`/results?resultId=${data.resultId}${reasonParam}`);
          return;
        }

        if (data.error && data.alreadyCompleted) {
          const reasonParam = reason === "strike_limit_exceeded" ? "&reason=strike_limit_exceeded" : "";
          router.push(`/results?resultId=${data.resultId}${reasonParam}`);
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

  // 1. Initial Load from Server (action: "init" -> loads questions without starting clock if first visit)
  useEffect(() => {
    if (!testId) {
      setErrorMessage("No examination selected. Returning to available tests...");
      setTimeout(() => router.push("/student/tests"), 1500);
      return;
    }

    const initExam = async () => {
      try {
        setExamPhase("loading");

        const res = await fetch("/api/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId, action: "init" }),
        });

        const data = await res.json();

        if (data.alreadyCompleted) {
          router.push(`/results?resultId=${data.resultId}`);
          return;
        }

        if (data.error || !data.questions) {
          setErrorMessage(data.error || "Failed to initialize examination");
          return;
        }

        setTestMeta(data.test);
        setQuestions(data.questions);

        // Synchronize strikes: higher value between server and localStorage wins
        const serverStrikes = data.strikes || 0;
        const localStrikes = parseInt(localStorage.getItem(`mathlete_strikes_${testId}`) || "0", 10);
        const resolvedStrikes = Math.max(serverStrikes, isNaN(localStrikes) ? 0 : localStrikes);
        setStrikes(resolvedStrikes);
        localStorage.setItem(`mathlete_strikes_${testId}`, resolvedStrikes.toString());

        if (resolvedStrikes > serverStrikes) {
          fetch("/api/exam/strike", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ testId, strikes: resolvedStrikes }),
          }).catch(console.error);
        }

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

        // Check if an unfinished attempt already existed from an earlier visit
        if (data.hasActiveAttempt) {
          const remSec = typeof data.remainingSeconds === "number" ? data.remainingSeconds : (data.test.duration_minutes || 60) * 60;
          initialRemainingSecondsRef.current = remSec;
          startPerformanceNowRef.current = performance.now();
          setTimeLeft(remSec);
          setIsResumed(true);
          setResumeMinutes(Math.max(1, Math.ceil(remSec / 60)));
          setExamPhase("active");
        } else {
          // First visit: wait for student to click "Begin exam" on instructions screen
          const initialSec = (data.test.duration_minutes || 60) * 60;
          initialRemainingSecondsRef.current = initialSec;
          setTimeLeft(initialSec);
          setExamPhase("instructions");
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMessage("Network error connecting to examination server.");
      }
    };

    initExam();
  }, [testId, router]);

  // Handler for student clicking "Begin exam" on Instructions screen
  const handleBeginExam = () => {
    // 1. Synchronously trigger fullscreen inside user click event loop BEFORE any await
    requestFullscreenSync();

    // 2. Start attempt on server and transition phase on the same page
    (async () => {
      try {
        const res = await fetch("/api/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId, action: "begin" }),
        });

        const data = await res.json();

        if (data.alreadyCompleted) {
          router.push(`/results?resultId=${data.resultId}`);
          return;
        }

        if (data.success) {
          const remSec =
            typeof data.remainingSeconds === "number"
              ? data.remainingSeconds
              : (testMeta?.duration_minutes || 60) * 60;
          initialRemainingSecondsRef.current = remSec;
          startPerformanceNowRef.current = performance.now();
          setTimeLeft(remSec);
          setExamPhase("active");
        } else {
          // Fallback: start timer with loaded initial duration
          startPerformanceNowRef.current = performance.now();
          setExamPhase("active");
        }
      } catch (err) {
        console.error("Error beginning exam attempt:", err);
        startPerformanceNowRef.current = performance.now();
        setExamPhase("active");
      }
    })();
  };

  // 2. Persist local student progress
  useEffect(() => {
    if (testId && examPhase === "active") {
      localStorage.setItem(`mathlete_answers_${testId}`, JSON.stringify(answers));
      localStorage.setItem(`mathlete_review_${testId}`, JSON.stringify(review));
      localStorage.setItem(`mathlete_index_${testId}`, currentIndex.toString());
    }
  }, [answers, review, currentIndex, testId, examPhase]);

  // 3. Monotonic Timer Countdown (driven by performance.now() - immune to system clock shifts)
  useEffect(() => {
    if (examPhase !== "active" || isSubmitting.current) return;

    const tick = () => {
      if (startPerformanceNowRef.current === 0) return;
      const elapsedSeconds = (performance.now() - startPerformanceNowRef.current) / 1000;
      const remaining = Math.max(0, Math.floor(initialRemainingSecondsRef.current - elapsedSeconds));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        handleSubmit("time_expired");
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [examPhase, handleSubmit]);

  // 4. Anti-Cheat: document "visibilitychange" with visibilityState === "hidden" ONLY
  useEffect(() => {
    if (examPhase !== "active" || isSubmitting.current || !testId) return;

    const maxStrikes = testMeta?.max_strikes ?? 3;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Tab-switch checking disabled if maxStrikes === 0
        if (maxStrikes <= 0) return;

        const now = performance.now();

        // PART 2.3: Ignore visibility events within 2 seconds of a fullscreenchange event
        if (now - lastFullscreenChangeRef.current < 2000) return;

        // PART 2.3: Debounce hide events (at least 1 second per hide/show cycle)
        if (now - lastHiddenTimeRef.current < 1000) return;

        lastHiddenTimeRef.current = now;
        pendingStrikeRef.current = true;

        // Record strike count immediately to server and local storage
        setStrikes((prevStrikes) => {
          const nextStrike = prevStrikes + 1;
          localStorage.setItem(`mathlete_strikes_${testId}`, nextStrike.toString());

          fetch("/api/exam/strike", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ testId, strikes: nextStrike }),
          }).catch(console.error);

          return nextStrike;
        });
      } else if (document.visibilityState === "visible") {
        // Tab regained focus: immediately recalculate monotonic timer to correct any background throttling
        if (startPerformanceNowRef.current > 0) {
          const elapsedSeconds = (performance.now() - startPerformanceNowRef.current) / 1000;
          const remaining = Math.max(0, Math.floor(initialRemainingSecondsRef.current - elapsedSeconds));
          setTimeLeft(remaining);
          if (remaining <= 0) {
            handleSubmit("time_expired");
            return;
          }
        }

        // Handle strike modal or auto-submission on return
        if (pendingStrikeRef.current) {
          pendingStrikeRef.current = false;
          const localStored = parseInt(localStorage.getItem(`mathlete_strikes_${testId}`) || "0", 10);
          const currentStrikes = Math.max(strikes, isNaN(localStored) ? 0 : localStored);

          if (currentStrikes >= maxStrikes && maxStrikes > 0) {
            // Auto-submit happens ONLY when strikes reach max_strikes
            setWarningModal({
              open: true,
              strikeNumber: currentStrikes,
              title: `Examination terminated (Strike ${currentStrikes} of ${maxStrikes})`,
              message:
                "You left the exam window too many times. Your responses are locked and being submitted.",
            });
            setIsAutoSubmitting(true);
            setTimeout(() => {
              handleSubmit("strike_limit_exceeded");
            }, 1200);
          } else if (currentStrikes > 0) {
            const remainingAllowed = maxStrikes - currentStrikes;
            setWarningModal({
              open: true,
              strikeNumber: currentStrikes,
              title:
                currentStrikes === 1
                  ? `Security notice (Strike 1 of ${maxStrikes})`
                  : `Security warning (Strike ${currentStrikes} of ${maxStrikes})`,
              message: `We record when you leave the exam window. Leaving the window ${remainingAllowed} more ${remainingAllowed === 1 ? "time" : "times"} will submit your test automatically.`,
            });
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [examPhase, testId, strikes, testMeta?.max_strikes, handleSubmit]);

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
    if (examPhase !== "active" || isSubmitting.current || questions.length === 0) return;

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
  }, [examPhase, currentIndex, questions, warningModal, isConfirmOpen, handleSelectOption, handleMarkReview]);

  // Loading Screen
  if (examPhase === "loading") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black text-zinc-100 space-y-3 font-sans">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-200 animate-spin rounded-full" />
        <div className="text-sm text-zinc-400 font-normal">
          Preparing examination environment...
        </div>
      </div>
    );
  }

  // Error Screen
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

  const maxStrikes = testMeta?.max_strikes ?? 3;

  // Instructions Screen (shown only when student has not yet started this exam)
  if (examPhase === "instructions") {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-lg w-full bg-zinc-950 border border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-150">
          <div className="space-y-2 border-b border-zinc-800 pb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Info className="w-3 h-3 text-zinc-400" />
              <span>Instructions & guidelines</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100">
              {testMeta?.title || "Examination"}
            </h1>
            <p className="text-xs text-zinc-400 font-normal">
              Review examination parameters before initiating your attempt
            </p>
          </div>

          {/* Test Meta Parameters */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs font-normal mb-1">
                <Clock className="w-3.5 h-3.5 text-zinc-500" /> Duration
              </div>
              <div className="text-lg font-semibold text-zinc-100 tabular-nums">
                {testMeta?.duration_minutes}m
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs font-normal mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-500" /> Questions
              </div>
              <div className="text-lg font-semibold text-zinc-100 tabular-nums">
                {questions.length}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs font-normal mb-1">
                <Check className="w-3.5 h-3.5 text-zinc-500" /> Marking
              </div>
              <div className="text-lg font-semibold text-zinc-100 tabular-nums">
                +{testMeta?.positive_marks ?? 4} / -{testMeta?.negative_marks ?? 1}
              </div>
            </div>
          </div>

          {/* Guidelines List */}
          <div className="space-y-3 text-xs text-zinc-300 font-normal border-t border-zinc-900 pt-5">
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
              <span>
                Your countdown timer begins only when you click <strong>Begin exam</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
              <span>
                All questions and mathematical notation have been loaded into local memory.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
              {maxStrikes > 0 ? (
                <span>
                  <strong>Security notice:</strong> We record when you leave the exam window. Leaving the window more than {maxStrikes} times will submit your test automatically.
                </span>
              ) : (
                <span>
                  Tab-switch checking is disabled for this examination.
                </span>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleBeginExam}
              className="w-full h-11 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>Begin exam</span>
              <Maximize2 className="w-4 h-4 text-zinc-700" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active Examination Viewport
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
      {/* Non-blocking Banner: Left Fullscreen */}
      {!isFullscreen && (
        <div className="bg-zinc-900 border-b border-zinc-800 text-zinc-300 px-4 py-2 text-xs flex items-center justify-between z-20 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>You left fullscreen</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={requestFullscreenSync}
            className="h-7 px-3 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
          >
            Enter fullscreen
          </Button>
        </div>
      )}

      {/* Non-blocking Banner: Resumed session */}
      {isResumed && (
        <div className="bg-emerald-950/40 border-b border-emerald-500/30 text-emerald-300 px-4 py-2 text-xs flex items-center justify-between z-20 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Resuming your exam, {resumeMinutes} minutes left</span>
          </div>
          <button
            type="button"
            onClick={() => setIsResumed(false)}
            className="text-xs text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

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
          {/* Strikes Counter (only shown when max_strikes > 0) */}
          {maxStrikes > 0 && (
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
                {strikes} / {maxStrikes} strikes
              </span>
            </div>
          )}

          {/* Countdown Timer (Monospace, monotonic performance.now() driven) */}
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

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-2 rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

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
            <span>Monitored examination session</span>
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
              {warningModal.strikeNumber < maxStrikes ? (
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
                {submissionError.toLowerCase().includes("network") ? "Network disruption" : "Submission notice"}
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