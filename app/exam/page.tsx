"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface Question {
  id: string;
  statement: string;
  options: string;
  correct_option_index: number;
}

function ExamEngineContent() {
  const searchParams = useSearchParams();
  const testId = searchParams.get("testId");
  const router = useRouter();
  const supabase = createClient();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const isSubmitting = useRef(false);

  // 1. Initial Load & Recovery from Local Storage
  useEffect(() => {
    if (!testId) {
      alert("No test selected.");
      router.push("/dashboard");
      return;
    }

    const loadTest = async () => {
      // Recover Answers and Review status
      const savedAnswers = localStorage.getItem(`answers_${testId}`);
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));

      const savedReview = localStorage.getItem(`review_${testId}`);
      if (savedReview) setReview(JSON.parse(savedReview));

      // Recover Timer or start fresh
      const { data: testData } = await supabase.from("tests").select("duration_minutes").eq("id", testId).single();
      if (testData) {
        const savedTime = localStorage.getItem(`time_${testId}`);
        if (savedTime) {
          setTimeLeft(parseInt(savedTime, 10));
        } else {
          setTimeLeft(testData.duration_minutes * 60);
        }
      }

      // Fetch questions
      const { data: qData, error } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId);

      if (!error && qData) {
        setQuestions(qData);
      }
      setIsLoading(false);
    };

    loadTest();
  }, [testId, router, supabase]);

  // 2. Save Progress on Every Change
  useEffect(() => {
    if (testId && !isLoading) {
      localStorage.setItem(`answers_${testId}`, JSON.stringify(answers));
      localStorage.setItem(`review_${testId}`, JSON.stringify(review));
    }
  }, [answers, review, testId, isLoading]);

  // 3. Bulletproof Timer (Saves every second)
  useEffect(() => {
    if (timeLeft === null || isSubmitting.current) return;

    if (timeLeft <= 0) {
      alert("Time is up! Submitting exam automatically.");
      handleSubmit();
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
  }, [timeLeft, testId]);

  const handleSelectOption = (qId: string, optIndex: number) => {
    setAnswers({ ...answers, [qId]: optIndex });
  };

  const handleClearResponse = () => {
    const currentQId = questions[currentIndex].id;
    const newAnswers = { ...answers };
    delete newAnswers[currentQId];
    setAnswers(newAnswers);
  };

  const handleMarkReview = () => {
    const currentQId = questions[currentIndex].id;
    setReview({ ...review, [currentQId]: !review[currentQId] });
  };

  // 4. Clean up Local Storage on Submit
  const handleSubmit = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    
    // Save final results payload
    localStorage.setItem(`results_${testId}`, JSON.stringify(answers));
    
    // Destroy in-progress cache
    localStorage.removeItem(`answers_${testId}`);
    localStorage.removeItem(`review_${testId}`);
    localStorage.removeItem(`time_${testId}`);

    alert("Exam Submitted Successfully.");
    router.push("/dashboard"); 
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-black text-white font-bold tracking-widest uppercase text-sm animate-pulse">Initializing Engine...</div>;
  if (questions.length === 0) return <div className="flex h-screen items-center justify-center bg-black text-white font-bold">No questions found for this test.</div>;

  const currentQ = questions[currentIndex];
  const parsedOptions = JSON.parse(currentQ.options);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950">
        <div className="font-bold tracking-tight">Mathlete Pro Gym</div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <div className="font-mono bg-zinc-900 px-4 py-2 rounded-none border border-zinc-800 text-lg">
            {timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : "00:00"}
          </div>
          <Button onClick={handleSubmit} variant="destructive" className="rounded-none font-bold">
            SUBMIT EXAM
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full flex-1 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-zinc-500 font-bold text-sm tracking-widest uppercase">
                <span>Question {currentIndex + 1}</span>
                <span className="w-12 h-[1px] bg-zinc-800"></span>
              </div>
            </div>
            
            <div className="text-2xl font-medium leading-relaxed">
              <Latex>{currentQ.statement}</Latex>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-6">
              {parsedOptions.map((opt: string, idx: number) => {
                const isSelected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(currentQ.id, idx)}
                    className={`p-5 text-left border rounded-none transition-all duration-200 ${
                      isSelected 
                        ? 'border-white bg-zinc-900 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' 
                        : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    <span className="font-bold mr-4 opacity-50">{String.fromCharCode(65 + idx)}.</span>
                    <Latex>{opt}</Latex>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-4xl mx-auto w-full pt-8 flex gap-4 mt-auto">
            <Button 
              onClick={handleMarkReview}
              className={`flex-1 rounded-none font-bold border ${review[currentQ.id] ? 'bg-yellow-600 text-black hover:bg-yellow-500 border-yellow-600' : 'bg-transparent text-white border-zinc-800 hover:bg-zinc-900'}`}
            >
              {review[currentQ.id] ? 'UNMARK REVIEW' : 'MARK FOR REVIEW'}
            </Button>
            <Button 
              onClick={handleClearResponse}
              className="flex-1 rounded-none bg-transparent border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold"
            >
              CLEAR RESPONSE
            </Button>
            <Button 
              disabled={currentIndex === questions.length - 1} 
              onClick={() => setCurrentIndex(prev => prev + 1)}
              className="flex-[2] rounded-none bg-white text-black hover:bg-zinc-200 font-bold"
            >
              SAVE & NEXT
            </Button>
          </div>
        </div>

        <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-6 flex flex-col">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Question Palette</div>
          
          <div className="grid grid-cols-5 gap-2 overflow-y-auto pb-4">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isReviewed = review[q.id];
              const isCurrent = idx === currentIndex;
              
              let btnClass = "border-zinc-800 text-zinc-500 bg-black"; 
              if (isCurrent) btnClass = "border-white text-white bg-zinc-900 ring-1 ring-white";
              else if (isAnswered && isReviewed) btnClass = "border-yellow-500 bg-yellow-900/30 text-yellow-500";
              else if (isAnswered) btnClass = "border-green-500 bg-green-900/30 text-green-500";
              else if (isReviewed) btnClass = "border-yellow-500 border-dashed text-yellow-500";

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 text-sm font-bold border rounded-none transition-colors ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-auto space-y-3 pt-6 border-t border-zinc-800 text-xs font-medium text-zinc-400">
            <div className="flex items-center gap-3"><div className="w-4 h-4 border border-green-500 bg-green-900/30"></div> Answered</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 border border-yellow-500 border-dashed"></div> Marked for Review</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 border border-yellow-500 bg-yellow-900/30"></div> Answered & Marked</div>
            <div className="flex items-center gap-3"><div className="w-4 h-4 border border-zinc-800 bg-black"></div> Not Visited</div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading Engine...</div>}>
      <ExamEngineContent />
    </Suspense>
  );
}