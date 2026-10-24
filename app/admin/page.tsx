"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AppSidebar from "@/components/AppSidebar";
import * as XLSX from "xlsx";

interface Test {
  id: string;
  title: string;
  duration_minutes: number;
}

interface TestResultRecord {
  id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  tests?: { title: string };
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  
  // Test Creation States
  const [newTestTitle, setNewTestTitle] = useState("");
  const [newTestDuration, setNewTestDuration] = useState("60");
  const [newPositiveMarks, setNewPositiveMarks] = useState("4");
  const [newNegativeMarks, setNewNegativeMarks] = useState("1");

  // Manual Question Addition States
  const [manualStatement, setManualStatement] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctIndex, setCorrectIndex] = useState("0");
  const [manualSolution, setManualSolution] = useState("");

  // Analytics States
  const [allResults, setAllResults] = useState<TestResultRecord[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  const fetchAdminData = useCallback(async () => {
    // Fetch Tests
    const { data: testData, error: testError } = await supabase.from("tests").select("*");
    if (!testError && testData) setTests(testData as Test[]);

    // Fetch All Student Results for Analytics
    const { data: resultsData, error: resultsError } = await supabase
      .from("test_results")
      .select("id, test_id, score, total_attempted, total_correct, created_at, tests(title)")
      .order("created_at", { ascending: false });

    if (!resultsError && resultsData) {
      setAllResults(resultsData as unknown as TestResultRecord[]);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const initializeAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        alert("Access Denied: You are not an admin.");
        router.push("/dashboard"); 
        return;
      }
      setIsAdmin(true);
      fetchAdminData();
    };
    initializeAdmin();
  }, [router, supabase, fetchAdminData]);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tests").insert([{ 
      title: newTestTitle, 
      duration_minutes: parseInt(newTestDuration, 10),
      positive_marks: parseFloat(newPositiveMarks),
      negative_marks: parseFloat(newNegativeMarks)
    }]);

    if (error) {
      alert("Failed to create test: " + error.message);
    } else {
      setNewTestTitle("");
      setNewPositiveMarks("4");
      setNewNegativeMarks("1");
      fetchAdminData();
      alert("Test Created Successfully!");
    }
  };

  const handleManualQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestId) {
      alert("Please select a target test first!");
      return;
    }

    const { error } = await supabase.from("questions").insert([{
      test_id: selectedTestId,
      statement: manualStatement,
      options: JSON.stringify([optA, optB, optC, optD]),
      correct_option_index: parseInt(correctIndex, 10),
      solution: manualSolution
    }]);

    if (error) {
      alert("Failed to add question: " + error.message);
    } else {
      alert("Question Added Successfully!");
      setManualStatement("");
      setOptA("");
      setOptB("");
      setOptC("");
      setOptD("");
      setManualSolution("");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTestId) {
      alert("Please select a Test Series first before uploading!");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBulk(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        const optionMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

        const formattedQuestions = json.map((row, index) => {
          const correctChar = String(row["Correct Answer"] || "").trim().toUpperCase();
          const correctIndex = optionMap[correctChar];
          if (correctIndex === undefined) throw new Error(`Row ${index + 2}: Correct Answer must be A, B, C, or D`);

          return {
            test_id: selectedTestId,
            statement: String(row["Question"] || ""),
            options: JSON.stringify([
              String(row["Option A"] || ""), String(row["Option B"] || ""), 
              String(row["Option C"] || ""), String(row["Option D"] || "")
            ]),
            correct_option_index: correctIndex,
            solution: row["Solution"] ? String(row["Solution"]) : ""
          };
        });

        const { error } = await supabase.from("questions").insert(formattedQuestions);
        if (error) throw error;
        alert(`Success! Imported ${formattedQuestions.length} questions.`);
      } catch (err) {
        alert("Upload Failed: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setIsUploadingBulk(false);
        e.target.value = ""; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold bg-black text-white">Loading Admin Portal...</div>;
  if (!isAdmin) return null;

  return (
    <AppSidebar>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-zinc-800 pb-6 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Faculty Command Center</h1>
          <p className="text-zinc-500 mt-2 text-xs uppercase tracking-widest font-semibold">Test Creation, Question Building & Student Analytics</p>
        </header>

        {/* 1. Create Test Series */}
        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">1. Create Test Series</CardTitle>
            <CardDescription className="text-zinc-500">Configure exam parameters and custom marking schemes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTest} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="space-y-2 md:col-span-5">
                <Label>Test Title</Label>
                <Input required value={newTestTitle} onChange={e => setNewTestTitle(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Time (mins)</Label>
                <Input required type="number" value={newTestDuration} onChange={e => setNewTestDuration(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Correct (+)</Label>
                <Input required type="number" step="any" value={newPositiveMarks} onChange={e => setNewPositiveMarks(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Wrong (-)</Label>
                <Input required type="number" step="any" value={newNegativeMarks} onChange={e => setNewNegativeMarks(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <div className="md:col-span-1">
                <Button type="submit" className="h-10 rounded-none bg-white text-black hover:bg-zinc-200 font-bold w-full text-xs">CREATE</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Global Test Selector for Question Adding */}
        <Card className="bg-zinc-900 border-zinc-700 rounded-none">
          <CardContent className="p-6 space-y-2">
            <Label className="text-sm font-bold uppercase tracking-widest text-zinc-300">Select Active Test Context for Questions</Label>
            <select className="w-full flex h-12 border border-zinc-700 bg-black px-4 py-2 text-sm focus-visible:outline-none rounded-none text-white font-medium" value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}>
              <option value="" disabled>-- Choose a test to add questions into --</option>
              {tests.map(test => (
                <option key={test.id} value={test.id}>{test.title} ({test.duration_minutes} mins)</option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* 2. Manual Question Builder */}
        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">2. Add Question Manually</CardTitle>
            <CardDescription className="text-zinc-500">Draft questions with LaTeX support and assign options.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualQuestionSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Question Statement (LaTeX supported)</Label>
                <textarea required rows={3} value={manualStatement} onChange={e => setManualStatement(e.target.value)} placeholder="e.g. Evaluate $\lim_{x \to 0} \frac{e^{x^2} - 1 - x^2}{x^4}$" className="w-full border border-zinc-800 bg-black p-3 text-sm focus:outline-none rounded-none text-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Option A</Label><Input required value={optA} onChange={e => setOptA(e.target.value)} className="bg-black border-zinc-800 rounded-none" /></div>
                <div className="space-y-2"><Label>Option B</Label><Input required value={optB} onChange={e => setOptB(e.target.value)} className="bg-black border-zinc-800 rounded-none" /></div>
                <div className="space-y-2"><Label>Option C</Label><Input required value={optC} onChange={e => setOptC(e.target.value)} className="bg-black border-zinc-800 rounded-none" /></div>
                <div className="space-y-2"><Label>Option D</Label><Input required value={optD} onChange={e => setOptD(e.target.value)} className="bg-black border-zinc-800 rounded-none" /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Correct Option</Label>
                  <select value={correctIndex} onChange={e => setCorrectIndex(e.target.value)} className="w-full flex h-10 border border-zinc-800 bg-black px-3 py-2 text-sm rounded-none text-white">
                    <option value="0">Option A</option>
                    <option value="1">Option B</option>
                    <option value="2">Option C</option>
                    <option value="3">Option D</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Official Solution & Explanation</Label>
                <textarea rows={2} value={manualSolution} onChange={e => setManualSolution(e.target.value)} placeholder="Optional step-by-step solution..." className="w-full border border-zinc-800 bg-black p-3 text-sm focus:outline-none rounded-none text-white" />
              </div>

              <Button type="submit" disabled={!selectedTestId} className="rounded-none bg-white text-black hover:bg-zinc-200 font-bold h-12 w-full">
                ADD QUESTION TO TEST
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 3. Excel Bulk Upload */}
        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">3. Bulk Upload via Excel</CardTitle>
            <CardDescription className="text-zinc-500">Upload an .xlsx file containing columns: Question, Option A, Option B, Option C, Option D, Correct Answer (A/B/C/D), Solution.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`p-6 border transition-colors rounded-none ${selectedTestId ? "bg-zinc-900 border-zinc-700" : "bg-black border-zinc-900 opacity-50"}`}>
              <Input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} disabled={isUploadingBulk || !selectedTestId} className="cursor-pointer bg-black border-zinc-800 rounded-none" />
              {isUploadingBulk && <p className="text-sm text-white mt-3 font-bold animate-pulse">Processing & Uploading...</p>}
            </div>
          </CardContent>
        </Card>

        {/* 4. Student Performance & History Analytics */}
        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">4. Student Attempt History & Analytics</CardTitle>
            <CardDescription className="text-zinc-500">Live feed of all test submissions and performance stats.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300 border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-widest">
                    <th className="py-3 px-4">Test Title</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Attempted</th>
                    <th className="py-3 px-4">Correct</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-600 font-medium">No student attempts recorded yet.</td>
                    </tr>
                  ) : (
                    allResults.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                        <td className="py-4 px-4 font-bold text-white">{item.tests?.title || "Unknown Test"}</td>
                        <td className="py-4 px-4 font-mono font-bold text-white">{item.score}</td>
                        <td className="py-4 px-4 font-mono">{item.total_attempted}</td>
                        <td className="py-4 px-4 font-mono text-green-500">{item.total_correct}</td>
                        <td className="py-4 px-4 text-zinc-500 text-xs">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="py-4 px-4 text-right">
                          <Button 
                            onClick={() => router.push(`/results?resultId=${item.id}`)}
                            className="h-8 px-4 rounded-none bg-zinc-900 border border-zinc-700 text-xs font-bold hover:bg-white hover:text-black"
                          >
                            VIEW
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppSidebar>
  );
}