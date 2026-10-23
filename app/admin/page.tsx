"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import * as XLSX from "xlsx";

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const [manualForm, setManualForm] = useState({
    statement: "",
    optA: "",
    optB: "",
    optC: "",
    optD: "",
    correct: "A",
    solution: ""
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== "test@gmail.com") { 
        router.push("/");
      } else {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [router, supabase]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingManual(true);
    
    try {
      const optionMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
      const formattedQuestion = {
        statement: manualForm.statement,
        options: JSON.stringify([manualForm.optA, manualForm.optB, manualForm.optC, manualForm.optD]),
        correct_option_index: optionMap[manualForm.correct],
        solution: manualForm.solution
      };

      const { error } = await supabase.from("questions").insert([formattedQuestion]);
      if (error) throw error;

      alert("Question added successfully!");
      setManualForm({ statement: "", optA: "", optB: "", optC: "", optD: "", correct: "A", solution: "" });
    } catch (err) {
      alert("Failed to add question: " + (err as Error).message);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const optionMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

        const formattedQuestions = json.map((row, index) => {
          const correctChar = String(row['Correct Answer']).trim().toUpperCase();
          const correctIndex = optionMap[correctChar];

          if (correctIndex === undefined) throw new Error(`Row ${index + 2}: Correct Answer must be A, B, C, or D`);

          return {
            statement: String(row['Question']),
            options: JSON.stringify([
              String(row['Option A'] || ""), 
              String(row['Option B'] || ""), 
              String(row['Option C'] || ""), 
              String(row['Option D'] || "")
            ]),
            correct_option_index: correctIndex,
            solution: row['Solution'] ? String(row['Solution']) : ""
          };
        });

        const { error } = await supabase.from("questions").insert(formattedQuestions);
        if (error) throw error;
        
        alert(`Success! Imported ${formattedQuestions.length} questions from Excel.`);
      } catch (err) {
        alert("Upload Failed: " + (err as Error).message);
      } finally {
        setIsUploadingBulk(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!isAdmin) return <div className="flex h-screen items-center justify-center font-bold">Verifying Admin...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl mt-4 grid md:grid-cols-2 gap-8">
      
      <Card className="border-primary/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Manual Entry</CardTitle>
          <CardDescription>Add a single question instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Question Statement (LaTeX supported)</Label>
              <textarea 
                required
                className="w-full min-h-[100px] flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="What is $\int x^2 dx$?"
                value={manualForm.statement}
                onChange={e => setManualForm({...manualForm, statement: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Option A</Label><Input required value={manualForm.optA} onChange={e => setManualForm({...manualForm, optA: e.target.value})} /></div>
              <div className="space-y-2"><Label>Option B</Label><Input required value={manualForm.optB} onChange={e => setManualForm({...manualForm, optB: e.target.value})} /></div>
              <div className="space-y-2"><Label>Option C</Label><Input required value={manualForm.optC} onChange={e => setManualForm({...manualForm, optC: e.target.value})} /></div>
              <div className="space-y-2"><Label>Option D</Label><Input required value={manualForm.optD} onChange={e => setManualForm({...manualForm, optD: e.target.value})} /></div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Correct Answer</Label>
              <select 
                className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={manualForm.correct}
                onChange={e => setManualForm({...manualForm, correct: e.target.value})}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Solution Explanation (Optional)</Label>
              <textarea 
                className="w-full min-h-[80px] flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Explanation or formulas..."
                value={manualForm.solution}
                onChange={e => setManualForm({...manualForm, solution: e.target.value})}
              />
            </div>

            <Button type="submit" className="w-full mt-4" disabled={isSubmittingManual}>
              {isSubmittingManual ? "Saving..." : "Add Question"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <Card className="border-secondary shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Bulk Upload</CardTitle>
            <CardDescription>Upload an Excel sheet (.xlsx) with hundreds of questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 border rounded-lg bg-secondary/20">
              <Input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleExcelUpload} 
                disabled={isUploadingBulk}
                className="cursor-pointer"
              />
              {isUploadingBulk && <p className="text-sm text-primary mt-3 font-bold animate-pulse">Processing & Uploading...</p>}
            </div>

            <div className="p-4 bg-muted/50 text-sm rounded-md border">
              <p className="font-bold text-foreground mb-2">Excel Sheet Format Rules:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Headers must be exactly: <b>Question, Option A, Option B, Option C, Option D, Correct Answer, Solution</b></li>
                <li><b>Correct Answer</b> must be strictly <b>A, B, C, or D</b></li>
                <li>Wrap math in `$` signs (e.g., `$x^2$`) for proper formatting.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}