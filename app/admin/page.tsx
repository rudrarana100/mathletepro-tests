"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import * as XLSX from "xlsx";

interface Test {
  id: string;
  title: string;
  duration_minutes: number;
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [newTestTitle, setNewTestTitle] = useState("");
  const [newTestDuration, setNewTestDuration] = useState("60");

  const [isUploadingBulk, setIsUploadingBulk] = useState(false);

  const fetchTests = useCallback(async () => {
    // Removed order('created_at') to match your actual database schema
    const { data, error } = await supabase
      .from("tests")
      .select("*");
    
    if (!error && data) setTests(data as Test[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const initializeAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        alert("Access Denied: You are not an admin.");
        router.push("/dashboard"); 
        return;
      }

      setIsAdmin(true);
      fetchTests();
    };

    initializeAdmin();
  }, [router, supabase, fetchTests]);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    // Removed is_published to match your actual database schema
    const { error } = await supabase.from("tests").insert([{ 
      title: newTestTitle, 
      duration_minutes: parseInt(newTestDuration, 10)
    }]);

    if (error) {
      alert("Failed to create test: " + error.message);
    } else {
      setNewTestTitle("");
      fetchTests();
      alert("Test Created Successfully!");
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
          if (correctIndex === undefined) {
            throw new Error(`Row ${index + 2}: Correct Answer must be A, B, C, or D`);
          }

          return {
            test_id: selectedTestId,
            statement: String(row["Question"] || ""),
            options: JSON.stringify([
              String(row["Option A"] || ""), 
              String(row["Option B"] || ""), 
              String(row["Option C"] || ""), 
              String(row["Option D"] || "")
            ]),
            correct_option_index: correctIndex,
            solution: row["Solution"] ? String(row["Solution"]) : ""
          };
        });

        const { error } = await supabase.from("questions").insert(formattedQuestions);
        if (error) throw error;
        
        alert(`Success! Imported ${formattedQuestions.length} questions into the selected test.`);
      } catch (err) {
        alert("Upload Failed: " + (err as Error).message);
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
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8 mt-4">
        
        <header className="border-b border-zinc-800 pb-6 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Faculty Dashboard</h1>
          <p className="text-zinc-500 mt-2 text-xs uppercase tracking-widest font-semibold">
            Manage Test Series and Question Banks
          </p>
        </header>

        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">1. Create Test Series</CardTitle>
            <CardDescription className="text-zinc-500">Create a new exam container before adding questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTest} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1 w-full">
                <Label>Test Title (e.g., Math Mock 1)</Label>
                <Input required value={newTestTitle} onChange={e => setNewTestTitle(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <div className="space-y-2 w-full md:w-32">
                <Label>Duration (mins)</Label>
                <Input required type="number" value={newTestDuration} onChange={e => setNewTestDuration(e.target.value)} className="bg-black border-zinc-800 rounded-none" />
              </div>
              <Button type="submit" className="h-10 rounded-none bg-white text-black hover:bg-zinc-200 font-bold w-full md:w-auto">Create Test</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800 rounded-none">
          <CardHeader>
            <CardTitle className="text-2xl">2. Upload Question Bank</CardTitle>
            <CardDescription className="text-zinc-500">Select a test and upload your Excel sheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-2">
              <Label className="text-lg font-bold">Select Target Test</Label>
              <select 
                className="w-full flex h-10 border border-zinc-800 bg-black px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-none"
                value={selectedTestId}
                onChange={e => setSelectedTestId(e.target.value)}
              >
                <option value="" disabled>-- Choose a test to upload questions into --</option>
                {tests.map(test => (
                  <option key={test.id} value={test.id}>{test.title} ({test.duration_minutes} mins)</option>
                ))}
              </select>
            </div>

            <div className={`p-6 border transition-colors rounded-none ${selectedTestId ? "bg-zinc-900 border-zinc-700" : "bg-black border-zinc-900 opacity-50"}`}>
              <Label className="mb-2 block">Upload Excel (.xlsx)</Label>
              <Input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleExcelUpload} 
                disabled={isUploadingBulk || !selectedTestId}
                className="cursor-pointer bg-black border-zinc-800 rounded-none"
              />
              {isUploadingBulk && <p className="text-sm text-white mt-3 font-bold animate-pulse">Processing & Uploading...</p>}
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}