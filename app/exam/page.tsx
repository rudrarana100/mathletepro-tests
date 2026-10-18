"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import 'katex/dist/katex.min.css';
import { InlineMath } from "react-katex";

type QuestionRecord = {
  id: string;
  statement: string;
  options: string | string[];
  [key: string]: unknown;
};

export default function ExamPage() {
  const supabase = createClient();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchExamData = async () => {
      const { data, error } = await supabase.from("questions").select("*");
      
      if (error) console.error("Error fetching questions:", error);
      if (data) setQuestions(data as QuestionRecord[]);

      const savedAnswers = localStorage.getItem("exam_answers");
      const savedTime = localStorage.getItem("exam_time");
      
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      if (savedTime) setTimeLeft(parseInt(savedTime, 10));
      
      setIsLoading(false);
    };
    fetchExamData();
  }, [supabase]); 

  useEffect(() => {
    if (isLoading) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev > 0 ? prev - 1 : 0;
        localStorage.setItem("exam_time", newTime.toString());
        return newTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelect = (val: string) => {
    const newAnswers = { ...answers, [currentQ]: val };
    setAnswers(newAnswers);
    localStorage.setItem("exam_answers", JSON.stringify(newAnswers));
  };

  const renderMath = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\$.*?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const submitExam = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify({ answers })
      });
      const resultData = await res.json();
      
      // Clear the active exam cache and save the final result
      localStorage.removeItem("exam_answers");
      localStorage.removeItem("exam_time");
      localStorage.setItem("final_result", JSON.stringify(resultData));
      
      // Redirect to the Results page
      router.push('/results');
    } catch (err) {
      console.error("Submission failed", err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-xl">Loading Exam Engine...</div>;
  if (questions.length === 0) return <div className="flex h-screen items-center justify-center font-bold text-xl">No questions found. Add some in the Admin panel!</div>;

  const q = questions[currentQ];
  const parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;

  return (
    <div className="container mx-auto p-4 max-w-5xl mt-4">
      <div className="flex justify-between items-center mb-6 p-4 bg-secondary rounded-lg">
        <h1 className="text-xl font-bold">Mock Test 1: Core Mathematics</h1>
        <div className="text-2xl font-mono text-destructive">{formatTime(timeLeft)}</div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Question {currentQ + 1} of {questions.length}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-lg p-4 bg-muted/30 rounded-md border">
                {renderMath(q.statement)}
              </div>
              
              <RadioGroup value={answers[currentQ] || ""} onValueChange={handleSelect} className="space-y-3">
                {parsedOptions.map((opt: string, i: number) => (
                  <div key={i} className={`flex items-center space-x-3 p-3 border rounded-md ${answers[currentQ] === i.toString() ? 'border-primary bg-primary/10' : ''}`}>
                    <RadioGroupItem value={i.toString()} id={`opt-${i}`} />
                    <Label htmlFor={`opt-${i}`} className="cursor-pointer w-full text-base">{renderMath(opt)}</Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex justify-between pt-6">
                <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(prev => prev - 1)}>
                  Previous
                </Button>
                {currentQ === questions.length - 1 ? (
                  <Button onClick={submitExam} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Exam"}
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentQ(prev => prev + 1)}>Save & Next</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <Card>
            <CardHeader><CardTitle>Palette</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-4 gap-2">
              {questions.map((_, i) => (
                <Button 
                  key={i} 
                  variant={answers[i] ? "default" : "outline"} 
                  className={`w-full h-10 ${currentQ === i ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setCurrentQ(i)}
                >
                  {i + 1}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}