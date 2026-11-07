"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import * as XLSX from "xlsx";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";
import {
  Shield,
  Layers,
  HelpCircle,
  Users,
  TrendingUp,
  Search,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  FileSpreadsheet,
  Sparkles,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

// ================================================================
// Interfaces
// ================================================================

export type AdminTab = "overview" | "tests" | "questions" | "bulk" | "students" | "analytics";

interface Test {
  id: string;
  title: string;
  duration_minutes: number;
  positive_marks?: number;
  negative_marks?: number;
  is_published?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string;
  questions?: Array<{ id: string }>;
}

interface Question {
  id: string;
  test_id: string;
  statement: string;
  options: string; // JSON string array of options
  correct_option_index: number;
  solution: string | null;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  image_url?: string | null;
  created_at?: string;
}

interface TestResultRecord {
  id: string;
  student_id: string;
  test_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  created_at: string;
  tests?: { title: string };
}

interface StudentProfile {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
  created_at?: string;
}

interface BulkPreviewRow {
  index: number;
  statement: string;
  options: [string, string, string, string];
  correctIndex: number;
  correctChar: string;
  solution: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  imageUrl: string;
  isValid: boolean;
  error?: string;
}

export default function AdminDashboard({
  initialTab = "overview",
}: {
  initialTab?: AdminTab;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  // Navigation & Authentication
  const [isAdmin, setIsAdmin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  // Sync activeTab when initialTab changes (route transitions)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Tests State
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [testSearchTerm, setTestSearchTerm] = useState("");
  const [testFilterStatus, setTestFilterStatus] = useState<"all" | "published" | "draft">("all");

  // Create Test Form
  const [newTestTitle, setNewTestTitle] = useState("");
  const [newTestDuration, setNewTestDuration] = useState("60");
  const [newPositiveMarks, setNewPositiveMarks] = useState("4");
  const [newNegativeMarks, setNewNegativeMarks] = useState("1");
  const [newIsPublished, setNewIsPublished] = useState(true);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  // Edit Test Modal
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("60");
  const [editPositiveMarks, setEditPositiveMarks] = useState("4");
  const [editNegativeMarks, setEditNegativeMarks] = useState("1");
  const [editIsPublished, setEditIsPublished] = useState(true);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Delete Test Modal
  const [deletingTest, setDeletingTest] = useState<Test | null>(null);

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionSearchTerm, setQuestionSearchTerm] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Manual Question Form State
  const [manualStatement, setManualStatement] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctIndex, setCorrectIndex] = useState("0");
  const [manualSolution, setManualSolution] = useState("");
  const [questionTopic, setQuestionTopic] = useState("General");
  const [questionDifficulty, setQuestionDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionImageUrl, setQuestionImageUrl] = useState("");
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const questionFormRef = useRef<HTMLDivElement>(null);

  // Bulk Upload State
  const [bulkRows, setBulkRows] = useState<BulkPreviewRow[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Students & Results State
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [allResults, setAllResults] = useState<TestResultRecord[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedStudentDrilldown, setSelectedStudentDrilldown] = useState<{
    profile: StudentProfile;
    results: TestResultRecord[];
  } | null>(null);

  // Analytics Filter
  const [analyticsTestFilter, setAnalyticsTestFilter] = useState("all");

  // ================================================================
  // Data Fetching
  // ================================================================

  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      let loadedTests: Test[] = [];
      let loadedResults: TestResultRecord[] = [];

      try {
        // 1. Fetch Tests with question counts
        const { data: testData, error: testError } = await supabase
          .from("tests")
          .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time, created_at, questions(id)")
          .order("created_at", { ascending: false });

        if (!testError && testData && testData.length > 0) {
          loadedTests = testData as unknown as Test[];
        }

        // 2. Fetch All Student Results for Analytics
        const { data: resultsData, error: resultsError } = await supabase
          .from("test_results")
          .select("id, student_id, test_id, score, total_attempted, total_correct, created_at, tests(title)")
          .order("created_at", { ascending: false });

        if (!resultsError && resultsData && resultsData.length > 0) {
          loadedResults = resultsData as unknown as TestResultRecord[];
        }

        // 3. Fetch Registered Profiles
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, email, role, full_name, created_at")
          .order("created_at", { ascending: false });

        if (profileData && profileData.length > 0) {
          setStudents(profileData as StudentProfile[]);
        }
      } catch {
        // Database offline
      }

      setTests(loadedTests);
      setAllResults(loadedResults);
      if (!selectedTestId && loadedTests.length > 0) {
        setSelectedTestId(loadedTests[0].id);
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedTestId]);

  // Fetch Questions for currently selected test
  const fetchQuestionsForTest = useCallback(
    async (testId: string) => {
      if (!testId) {
        setQuestions([]);
        return;
      }
      setIsQuestionsLoading(true);

      try {
        const { data, error } = await supabase
          .from("questions")
          .select("id, test_id, statement, options, correct_option_index, solution, topic, difficulty, image_url, created_at")
          .eq("test_id", testId)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setQuestions(data as Question[]);
        } else {
          setQuestions([]);
        }
      } catch {
        setQuestions([]);
      } finally {
        setIsQuestionsLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (selectedTestId) {
      fetchQuestionsForTest(selectedTestId);
    }
  }, [selectedTestId, fetchQuestionsForTest]);

  // Sync hash routing on load if present
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (["overview", "tests", "questions", "bulk", "students", "analytics"].includes(hash)) {
        setActiveTab(hash as AdminTab);
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Initialize admin data
  useEffect(() => {
    setIsAdmin(true);
    fetchAdminData();
  }, [fetchAdminData]);

  // ================================================================
  // Test Actions: Create, Edit, Toggle Publish, Duplicate, Delete
  // ================================================================

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestTitle.trim()) return;
    setIsCreatingTest(true);

    try {
      const payload = {
        title: newTestTitle.trim(),
        duration_minutes: parseInt(newTestDuration, 10) || 60,
        positive_marks: parseFloat(newPositiveMarks) || 4,
        negative_marks: parseFloat(newNegativeMarks) || 1,
        is_published: newIsPublished,
        start_time: newStartTime ? new Date(newStartTime).toISOString() : null,
        end_time: newEndTime ? new Date(newEndTime).toISOString() : null,
      };

      const { data, error } = await supabase
        .from("tests")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setNewTestTitle("");
      setNewStartTime("");
      setNewEndTime("");
      await fetchAdminData();
      if (data) {
        setSelectedTestId(data.id);
      }
      success(`Test series "${payload.title}" created successfully!`);
    } catch (err) {
      toastError("Failed to create test: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsCreatingTest(false);
    }
  };

  const handleTogglePublish = async (test: Test) => {
    const nextState = !(test.is_published ?? true);
    // Optimistic local update
    setTests((prev) =>
      prev.map((t) => (t.id === test.id ? { ...t, is_published: nextState } : t))
    );

    const { error } = await supabase
      .from("tests")
      .update({ is_published: nextState })
      .eq("id", test.id);

    if (error) {
      toastError("Failed to update status: " + error.message);
      fetchAdminData();
    } else {
      success(`"${test.title}" is now ${nextState ? "Published" : "in Draft mode"}.`);
    }
  };

  const handleOpenEditTest = (test: Test) => {
    setEditingTest(test);
    setEditTitle(test.title);
    setEditDuration(test.duration_minutes.toString());
    setEditPositiveMarks((test.positive_marks ?? 4).toString());
    setEditNegativeMarks((test.negative_marks ?? 1).toString());
    setEditIsPublished(test.is_published ?? true);
    setEditStartTime(test.start_time ? new Date(test.start_time).toISOString().slice(0, 16) : "");
    setEditEndTime(test.end_time ? new Date(test.end_time).toISOString().slice(0, 16) : "");
  };

  const handleSaveEditTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;

    try {
      const { error } = await supabase
        .from("tests")
        .update({
          title: editTitle.trim(),
          duration_minutes: parseInt(editDuration, 10) || 60,
          positive_marks: parseFloat(editPositiveMarks) || 4,
          negative_marks: parseFloat(editNegativeMarks) || 1,
          is_published: editIsPublished,
          start_time: editStartTime ? new Date(editStartTime).toISOString() : null,
          end_time: editEndTime ? new Date(editEndTime).toISOString() : null,
        })
        .eq("id", editingTest.id);

      if (error) throw error;
      setEditingTest(null);
      await fetchAdminData();
      success("Test settings updated successfully!");
    } catch (err) {
      toastError("Failed to update test: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDuplicateTest = async (test: Test) => {
    if (!confirm(`Duplicate test "${test.title}" along with all its questions?`)) return;

    try {
      // 1. Insert new test
      const { data: newTest, error: testErr } = await supabase
        .from("tests")
        .insert([
          {
            title: `${test.title} (Copy)`,
            duration_minutes: test.duration_minutes,
            positive_marks: test.positive_marks ?? 4,
            negative_marks: test.negative_marks ?? 1,
            is_published: false, // Start duplicate as draft
            start_time: test.start_time,
            end_time: test.end_time,
          },
        ])
        .select()
        .single();

      if (testErr || !newTest) throw testErr || new Error("Could not clone test");

      // 2. Fetch all original questions
      const { data: origQuestions } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", test.id);

      if (origQuestions && origQuestions.length > 0) {
        // Strip ids and re-link to newTest.id
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const clonedQuestions = origQuestions.map(({ id: _id, created_at: _ca, ...rest }) => ({
          ...rest,
          test_id: newTest.id,
        }));

        const { error: qErr } = await supabase.from("questions").insert(clonedQuestions);
        if (qErr) console.warn("Notice cloning questions:", qErr.message);
      }

      await fetchAdminData();
      setSelectedTestId(newTest.id);
      success(`Cloned "${test.title}" into a new draft test!`);
    } catch (err) {
      toastError("Failed to duplicate test: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDeleteTest = async () => {
    if (!deletingTest) return;

    try {
      // Explicitly remove questions first to avoid constraint warnings
      await supabase.from("questions").delete().eq("test_id", deletingTest.id);
      const { error } = await supabase.from("tests").delete().eq("id", deletingTest.id);

      if (error) throw error;

      if (selectedTestId === deletingTest.id) {
        setSelectedTestId("");
      }
      setDeletingTest(null);
      await fetchAdminData();
      success("Test deleted successfully.");
    } catch (err) {
      toastError("Failed to delete test: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // ================================================================
  // Question Actions: Add / Edit / Delete
  // ================================================================

  const handleEditQuestionClick = (q: Question) => {
    setEditingQuestionId(q.id);
    setManualStatement(q.statement);
    try {
      const opts = JSON.parse(q.options || "[]");
      setOptA(opts[0] || "");
      setOptB(opts[1] || "");
      setOptC(opts[2] || "");
      setOptD(opts[3] || "");
    } catch {
      setOptA("");
      setOptB("");
      setOptC("");
      setOptD("");
    }
    setCorrectIndex(q.correct_option_index.toString());
    setManualSolution(q.solution || "");
    setQuestionTopic(q.topic || "General");
    setQuestionDifficulty(q.difficulty || "medium");
    setQuestionImageUrl(q.image_url || "");

    questionFormRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setManualStatement("");
    setOptA("");
    setOptB("");
    setOptC("");
    setOptD("");
    setCorrectIndex("0");
    setManualSolution("");
    setQuestionTopic("General");
    setQuestionDifficulty("medium");
    setQuestionImageUrl("");
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestId) {
      toastError("Please select a target test series first!");
      return;
    }
    if (!manualStatement.trim()) {
      toastError("Question statement cannot be empty.");
      return;
    }

    setIsSavingQuestion(true);
    const optionsArray = JSON.stringify([optA.trim(), optB.trim(), optC.trim(), optD.trim()]);
    const payload = {
      test_id: selectedTestId,
      statement: manualStatement.trim(),
      options: optionsArray,
      correct_option_index: parseInt(correctIndex, 10),
      solution: manualSolution.trim() || null,
      topic: questionTopic.trim() || "General",
      difficulty: questionDifficulty,
      image_url: questionImageUrl.trim() || null,
    };

    try {
      if (editingQuestionId) {
        // Update existing question
        const { error } = await supabase
          .from("questions")
          .update(payload)
          .eq("id", editingQuestionId);

        if (error) throw error;
        success("Question updated successfully!");
      } else {
        // Insert new question
        const { error } = await supabase.from("questions").insert([payload]);
        if (error) throw error;
        success("Question added to test series!");
      }

      handleCancelQuestionEdit();
      fetchQuestionsForTest(selectedTestId);
      fetchAdminData();
    } catch (err) {
      toastError("Failed to save question: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) throw error;
      success("Question removed from bank.");
      fetchQuestionsForTest(selectedTestId);
      fetchAdminData();
    } catch (err) {
      toastError("Failed to delete question: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // Image upload handler (uploads to storage or creates preview)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // First attempt to upload to Supabase Storage bucket 'question-images'
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedTestId || "misc"}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("question-images")
        .upload(fileName, file);

      if (!error && data) {
        const { data: pubData } = supabase.storage.from("question-images").getPublicUrl(fileName);
        if (pubData?.publicUrl) {
          setQuestionImageUrl(pubData.publicUrl);
          return;
        }
      }
    } catch {
      // Storage bucket not provisioned, fall back to base64 data URL
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setQuestionImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // ================================================================
  // Excel Template & Bulk Upload Studio
  // ================================================================

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Question: "Evaluate $\\lim_{x \\to 0} \\frac{e^{x^2} - 1 - x^2}{x^4}$",
        "Option A": "$1/2$",
        "Option B": "$1/4$",
        "Option C": "$0$",
        "Option D": "Does not exist",
        "Correct Answer": "A",
        Solution: "Using Maclaurin expansion: $e^{u} = 1 + u + \\frac{u^2}{2} + O(u^3)$. Substitute $u = x^2$ to get $1/2$.",
        Topic: "Calculus",
        Difficulty: "medium",
        "Image URL": "",
      },
      {
        Question: "What is the determinant of a $2 \\times 2$ matrix $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$?",
        "Option A": "$ab - cd$",
        "Option B": "$ad - bc$",
        "Option C": "$ac - bd$",
        "Option D": "$a + d$",
        "Correct Answer": "B",
        Solution: "By standard determinant definition for order 2: $\\det(A) = ad - bc$.",
        Topic: "Linear Algebra",
        Difficulty: "easy",
        "Image URL": "",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mathlete_Questions");
    XLSX.writeFile(workbook, "mathlete_questions_template.xlsx");
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkSummary(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const getCol = (row: Record<string, unknown>, ...keys: string[]): string => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
              return String(row[k]).trim();
            }
          }
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const cleanedK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
            const match = rowKeys.find(
              (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanedK
            );
            if (match && row[match] !== undefined && row[match] !== null) {
              return String(row[match]).trim();
            }
          }
          return "";
        };

        const optionMap: Record<string, number> = {
          A: 0, B: 1, C: 2, D: 3,
          "1": 0, "2": 1, "3": 2, "4": 3,
          "0": 0,
          "OPTION A": 0, "OPTION B": 1, "OPTION C": 2, "OPTION D": 3,
          "OPTION 1": 0, "OPTION 2": 1, "OPTION 3": 2, "OPTION 4": 3,
          "OPT A": 0, "OPT B": 1, "OPT C": 2, "OPT D": 3,
        };

        const parsedRows: BulkPreviewRow[] = json.map((row, index) => {
          const rowNum = index + 2;
          const statement = getCol(row, "Question", "Statement", "Question Statement", "QuestionText");
          const opt1 = getCol(row, "Option A", "OptionA", "Option 1", "Opt A", "A");
          const opt2 = getCol(row, "Option B", "OptionB", "Option 2", "Opt B", "B");
          const opt3 = getCol(row, "Option C", "OptionC", "Option 3", "Opt C", "C");
          const opt4 = getCol(row, "Option D", "OptionD", "Option 4", "Opt D", "D");
          const rawAns = getCol(row, "Correct Answer", "Correct", "Answer", "Correct Option", "Key");
          const correctChar = rawAns.toUpperCase();
          const solution = getCol(row, "Solution", "Explanation", "Proof", "Detailed Solution");
          const topic = getCol(row, "Topic", "Subject", "Category", "Unit") || "General";
          const rawDiff = getCol(row, "Difficulty", "Level", "Difficulty Level").toLowerCase();
          const difficulty: "easy" | "medium" | "hard" =
            rawDiff === "easy" || rawDiff === "hard" ? rawDiff : "medium";
          const imageUrl = getCol(row, "Image URL", "ImageUrl", "Image", "Diagram");

          // Validation
          const errors: string[] = [];
          if (!statement) errors.push(`Row ${rowNum}: Question statement is empty`);
          if (!opt1) errors.push(`Row ${rowNum}: Option A is missing`);
          if (!opt2) errors.push(`Row ${rowNum}: Option B is missing`);
          if (!opt3) errors.push(`Row ${rowNum}: Option C is missing`);
          if (!opt4) errors.push(`Row ${rowNum}: Option D is missing`);
          if (optionMap[correctChar] === undefined) {
            errors.push(`Row ${rowNum}: Correct Answer '${rawAns}' is invalid (must be A, B, C, D or 1, 2, 3, 4)`);
          }

          const isValid = errors.length === 0;
          const canonicalChar = ["A", "B", "C", "D"][optionMap[correctChar] ?? 0] || "A";
          return {
            index: rowNum,
            statement,
            options: [opt1, opt2, opt3, opt4],
            correctChar: canonicalChar,
            correctIndex: optionMap[correctChar] ?? 0,
            solution,
            topic,
            difficulty,
            imageUrl,
            isValid,
            error: errors.join("; "),
          };
        });

        setBulkRows(parsedRows);
      } catch (err) {
        toastError("Failed to parse Excel file: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportValidBulkRows = async () => {
    if (!selectedTestId) {
      toastError("Please select a target test series first!");
      return;
    }

    const validRows = bulkRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toastError("No valid rows to import. Please resolve row-level errors.");
      return;
    }

    setIsUploadingBulk(true);
    try {
      const formatted = validRows.map((r) => ({
        test_id: selectedTestId,
        statement: r.statement,
        options: JSON.stringify(r.options),
        correct_option_index: r.correctIndex,
        solution: r.solution || null,
        topic: r.topic,
        difficulty: r.difficulty,
        image_url: r.imageUrl || null,
      }));

      const { error } = await supabase.from("questions").insert(formatted);
      if (error) throw error;

      const skippedCount = bulkRows.length - validRows.length;
      const summaryMsg = `Successfully imported ${validRows.length} questions into active test.${
        skippedCount > 0 ? ` (${skippedCount} invalid rows skipped)` : ""
      }`;
      setBulkSummary(summaryMsg);
      success(summaryMsg);
      setBulkRows([]);
      if (bulkFileRef.current) bulkFileRef.current.value = "";
      fetchQuestionsForTest(selectedTestId);
      fetchAdminData();
    } catch (err) {
      toastError("Import failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsUploadingBulk(false);
    }
  };

  // ================================================================
  // Analytics & CSV Export
  // ================================================================

  const filteredResults = useMemo(() => {
    if (analyticsTestFilter === "all") return allResults;
    return allResults.filter((r) => r.test_id === analyticsTestFilter);
  }, [allResults, analyticsTestFilter]);

  const analyticsStats = useMemo(() => {
    const total = filteredResults.length;
    if (total === 0) {
      return { total: 0, avg: 0, max: 0, min: 0, accuracy: 0 };
    }
    const scores = filteredResults.map((r) => r.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / total);
    const max = Math.max(...scores);
    const min = Math.min(...scores);

    const totalAtt = filteredResults.reduce((a, b) => a + (b.total_attempted || 0), 0);
    const totalCor = filteredResults.reduce((a, b) => a + (b.total_correct || 0), 0);
    const accuracy = totalAtt > 0 ? Math.round((totalCor / totalAtt) * 100) : 0;

    return { total, avg, max, min, accuracy };
  }, [filteredResults]);

  // Score distribution for histogram (4 buckets: <25%, 25-50%, 50-75%, 75-100%)
  const scoreDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0];
    if (filteredResults.length === 0) return buckets;

    const maxScore = analyticsStats.max > 0 ? analyticsStats.max : 100;
    filteredResults.forEach((r) => {
      const pct = maxScore > 0 ? (r.score / maxScore) * 100 : 0;
      if (pct < 25) buckets[0]++;
      else if (pct < 50) buckets[1]++;
      else if (pct < 75) buckets[2]++;
      else buckets[3]++;
    });
    return buckets;
  }, [filteredResults, analyticsStats.max]);

  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      toastError("No attempt results found to export.");
      return;
    }

    const studentMap = new Map<string, string>();
    students.forEach((s) => studentMap.set(s.id, s.email));

    const csvHeaders = ["Result ID", "Student ID", "Student Email", "Test Title", "Score", "Attempted", "Correct", "Date"];
    const rows = filteredResults.map((r) => [
      r.id,
      r.student_id,
      studentMap.get(r.student_id) || "N/A",
      r.tests?.title || "Test",
      r.score,
      r.total_attempted,
      r.total_correct,
      new Date(r.created_at).toISOString(),
    ]);

    const csvContent = [csvHeaders, ...rows]
      .map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mathlete_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Submissions export file downloaded.");
  };

  // ================================================================
  // Students Aggregations
  // ================================================================

  const aggregatedStudents = useMemo(() => {
    const studentResultsMap = new Map<string, TestResultRecord[]>();
    allResults.forEach((r) => {
      const arr = studentResultsMap.get(r.student_id) || [];
      arr.push(r);
      studentResultsMap.set(r.student_id, arr);
    });

    // Start with profiles
    const list = students.map((s) => {
      const results = studentResultsMap.get(s.id) || [];
      const totalAttempts = results.length;
      const avgScore =
        totalAttempts > 0
          ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalAttempts)
          : 0;
      const bestScore = totalAttempts > 0 ? Math.max(...results.map((r) => r.score)) : 0;
      const lastActive =
        totalAttempts > 0
          ? results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : s.created_at || "N/A";

      return {
        profile: s,
        totalAttempts,
        avgScore,
        bestScore,
        lastActive,
        results,
      };
    });

    if (studentSearchTerm.trim()) {
      const term = studentSearchTerm.toLowerCase();
      return list.filter(
        (item) =>
          item.profile.email.toLowerCase().includes(term) ||
          (item.profile.full_name || "").toLowerCase().includes(term) ||
          item.profile.id.toLowerCase().includes(term)
      );
    }
    return list;
  }, [students, allResults, studentSearchTerm]);

  // Filtered Tests
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(testSearchTerm.toLowerCase());
      if (testFilterStatus === "published") return matchesSearch && t.is_published !== false;
      if (testFilterStatus === "draft") return matchesSearch && t.is_published === false;
      return matchesSearch;
    });
  }, [tests, testSearchTerm, testFilterStatus]);

  // Selected Test Object
  const currentSelectedTest = useMemo(() => {
    return tests.find((t) => t.id === selectedTestId);
  }, [tests, selectedTestId]);

  // Computed aggregations for Overview
  const totalQuestionsInBank = useMemo(() => {
    return tests.reduce((acc, t) => acc + (t.questions?.length || 0), 0);
  }, [tests]);

  const publishedCount = useMemo(() => {
    return tests.filter((t) => t.is_published !== false).length;
  }, [tests]);

  const draftCount = useMemo(() => {
    return tests.filter((t) => t.is_published === false).length;
  }, [tests]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center font-bold font-mono bg-black text-white">
        <RefreshCw className="w-5 h-5 animate-spin mr-3 text-zinc-400" />
        INITIALIZING FACULTY COMMAND CENTER...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <PageHeader
          title="Faculty Command Center"
          description="Test Series Architecture, Question Bank Studio & Cohort Performance Intelligence"
          breadcrumbs={[
            { label: "Mathlete", href: "/admin" },
            { label: "Faculty Panel" },
            { label: "Command Center" },
          ]}
          action={
            <Button
              onClick={fetchAdminData}
              variant="outline"
              size="sm"
              className="rounded-none border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 font-mono text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SYNC CLOUD</span>
            </Button>
          }
        />

        {/* Top Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 overflow-x-auto pb-1">
          {[
            { id: "overview", label: "Overview", icon: Shield },
            { id: "tests", label: "Test Series", icon: Layers },
            { id: "questions", label: "Question Studio", icon: HelpCircle },
            { id: "bulk", label: "Excel Bulk Studio", icon: FileSpreadsheet },
            { id: "students", label: "Student Directory", icon: Users },
            { id: "analytics", label: "Analytics & Export", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  window.location.hash = tab.id;
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all rounded-none border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-white text-white bg-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* TAB 0: EXECUTIVE FACULTY OVERVIEW */}
        {/* ============================================================ */}
        {activeTab === "overview" && (
          <div id="overview" className="space-y-8">
            {/* KPI Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Test Series
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-3xl font-black font-mono text-white">
                    {tests.length}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 bg-emerald-950/20">
                    {publishedCount} Live
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono mt-2 block">
                  {draftCount} in draft staging
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Questions in Bank
                </span>
                <span className="text-3xl font-black font-mono text-white mt-1 block">
                  {totalQuestionsInBank}
                </span>
                <span className="text-xs text-zinc-500 font-mono mt-2 block">
                  Across {tests.length} examinations
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Enrolled Candidates
                </span>
                <span className="text-3xl font-black font-mono text-white mt-1 block">
                  {students.length}
                </span>
                <span className="text-xs text-zinc-500 font-mono mt-2 block">
                  Registered student accounts
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Lifetime Submissions
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-3xl font-black font-mono text-emerald-400">
                    {allResults.length}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 border border-zinc-800 px-1.5 py-0.5 bg-zinc-900">
                    {analyticsStats.avg} pts avg
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono mt-2 block">
                  {analyticsStats.accuracy}% cohort accuracy
                </span>
              </Card>
            </div>

            {/* Quick Actions Bar */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                  Faculty Quick Actions:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      setActiveTab("tests");
                      window.location.hash = "tests";
                    }}
                    className="h-8 rounded-none bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Create Test</span>
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveTab("questions");
                      window.location.hash = "questions";
                    }}
                    variant="outline"
                    className="h-8 rounded-none border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-white hover:text-black text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Question Studio</span>
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveTab("bulk");
                      window.location.hash = "bulk";
                    }}
                    variant="outline"
                    className="h-8 rounded-none border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-white hover:text-black text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    <span>Bulk Upload</span>
                  </Button>
                  <Button
                    onClick={handleExportCSV}
                    variant="outline"
                    className="h-8 rounded-none border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-white hover:text-black text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Active Tests & Recent Activity Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Active Tests (7 cols) */}
              <Card className="lg:col-span-7 bg-zinc-950 border-zinc-800 rounded-none shadow-none">
                <CardHeader className="border-b border-zinc-900 pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-400" />
                      <span>Configured Tests ({tests.length})</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Overview of live examinations and draft assessments.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActiveTab("tests");
                      window.location.hash = "tests";
                    }}
                    className="h-7 text-xs font-mono text-zinc-400 hover:text-white rounded-none"
                  >
                    <span>Manage All</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest bg-zinc-950">
                          <th className="py-2.5 px-3">Title</th>
                          <th className="py-2.5 px-3">Inquiries</th>
                          <th className="py-2.5 px-3">Marking</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {tests.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-zinc-600">
                              No test series created yet.
                            </td>
                          </tr>
                        ) : (
                          tests.slice(0, 6).map((test) => {
                            const isPublished = test.is_published !== false;
                            const qCount = test.questions?.length ?? 0;
                            return (
                              <tr key={test.id} className="hover:bg-zinc-900/40">
                                <td className="py-2.5 px-3 font-sans font-bold text-white max-w-[200px] truncate">
                                  {test.title}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-300">{qCount} Qs</td>
                                <td className="py-2.5 px-3 text-zinc-400">
                                  +{test.positive_marks ?? 4}/-{test.negative_marks ?? 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePublish(test)}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-bold uppercase ${
                                      isPublished
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                        : "border-zinc-700 bg-zinc-900 text-zinc-400"
                                    }`}
                                  >
                                    {isPublished ? "PUBLISHED" : "DRAFT"}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedTestId(test.id);
                                      setActiveTab("questions");
                                      window.location.hash = "questions";
                                    }}
                                    className="h-6 px-2 text-[11px] text-zinc-300 hover:text-white rounded-none"
                                  >
                                    Questions
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Submissions Feed (5 cols) */}
              <Card className="lg:col-span-5 bg-zinc-950 border-zinc-800 rounded-none shadow-none">
                <CardHeader className="border-b border-zinc-900 pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-zinc-400" />
                      <span>Recent Submissions</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Latest completed attempts.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActiveTab("analytics");
                      window.location.hash = "analytics";
                    }}
                    className="h-7 text-xs font-mono text-zinc-400 hover:text-white rounded-none"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-900">
                    {allResults.length === 0 ? (
                      <p className="p-6 text-center text-zinc-600 font-mono text-xs">
                        No submissions recorded yet.
                      </p>
                    ) : (
                      allResults.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="p-3 hover:bg-zinc-900/40 flex items-center justify-between gap-3 text-xs font-mono"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-white font-sans font-bold text-xs truncate">
                              {r.tests?.title || "Examination"}
                            </p>
                            <p className="text-zinc-500 text-[10px]">
                              {new Date(r.created_at).toLocaleDateString()} &middot; ID: {r.student_id.slice(0, 8)}...
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-emerald-400 font-bold">{r.score} pts</p>
                            <button
                              onClick={() => router.push(`/results?resultId=${r.id}`)}
                              className="text-[10px] text-zinc-400 hover:text-white underline uppercase"
                            >
                              Inspect
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: TEST SERIES MANAGEMENT */}
        {/* ============================================================ */}
        {activeTab === "tests" && (
          <div id="tests" className="space-y-8">
            {/* Create Test Series Card */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                  <Plus className="w-5 h-5 text-zinc-400" />
                  <span>Create New Test Series</span>
                </CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  Set up timing, custom marking scheme, and optional scheduling window.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateTest} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="space-y-1.5 md:col-span-5">
                      <Label className="text-xs uppercase font-mono text-zinc-400">Test Title</Label>
                      <Input
                        required
                        placeholder="e.g. Real Analysis Examination - JEE Advanced"
                        value={newTestTitle}
                        onChange={(e) => setNewTestTitle(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none text-white text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs uppercase font-mono text-zinc-400">Duration (min)</Label>
                      <Input
                        required
                        type="number"
                        min="1"
                        value={newTestDuration}
                        onChange={(e) => setNewTestDuration(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none font-mono text-white text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs uppercase font-mono text-zinc-400">Positive (+)</Label>
                      <Input
                        required
                        type="number"
                        step="any"
                        value={newPositiveMarks}
                        onChange={(e) => setNewPositiveMarks(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none font-mono text-white text-sm"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-3">
                      <Label className="text-xs uppercase font-mono text-zinc-400">Negative (-)</Label>
                      <Input
                        required
                        type="number"
                        step="any"
                        value={newNegativeMarks}
                        onChange={(e) => setNewNegativeMarks(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none font-mono text-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Scheduling & Publish toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-zinc-900 items-end">
                    <div className="space-y-1.5 md:col-span-4">
                      <Label className="text-xs uppercase font-mono text-zinc-400">
                        Scheduled Window Start (Optional)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none font-mono text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-4">
                      <Label className="text-xs uppercase font-mono text-zinc-400">
                        Scheduled Window End (Optional)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="bg-black border-zinc-800 rounded-none font-mono text-white text-xs"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center gap-2 h-10">
                      <label className="flex items-center gap-2 text-xs font-mono uppercase text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newIsPublished}
                          onChange={(e) => setNewIsPublished(e.target.checked)}
                          className="rounded-none border-zinc-700 bg-black text-white focus:ring-0"
                        />
                        <span>Publish Now</span>
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        disabled={isCreatingTest}
                        className="w-full h-10 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider"
                      >
                        {isCreatingTest ? "CREATING..." : "CREATE TEST"}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Test Series Repository */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-zinc-400" />
                      <span>Configured Test Series ({filteredTests.length})</span>
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Inspect existing tests, modify marking schemes, toggle live status, duplicate, or manage question banks.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-zinc-500" />
                      <Input
                        placeholder="Search tests..."
                        value={testSearchTerm}
                        onChange={(e) => setTestSearchTerm(e.target.value)}
                        className="pl-8 bg-black border-zinc-800 rounded-none text-xs h-9"
                      />
                    </div>

                    <select
                      value={testFilterStatus}
                      onChange={(e) => setTestFilterStatus(e.target.value as typeof testFilterStatus)}
                      className="bg-black border border-zinc-800 text-xs font-mono px-3 h-9 text-zinc-300 rounded-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="published">Published</option>
                      <option value="draft">Drafts Only</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest bg-zinc-950">
                        <th className="py-3 px-4">Title & Context</th>
                        <th className="py-3 px-4">Questions</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Marking</th>
                        <th className="py-3 px-4">Window</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {filteredTests.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-600">
                            No test series found matching your query.
                          </td>
                        </tr>
                      ) : (
                        filteredTests.map((test) => {
                          const qCount = test.questions?.length ?? 0;
                          const isPublished = test.is_published !== false;
                          const hasWindow = Boolean(test.start_time || test.end_time);

                          return (
                            <tr key={test.id} className="hover:bg-zinc-900/40 transition-colors">
                              <td className="py-3.5 px-4 font-sans font-bold text-white max-w-xs">
                                <div className="truncate text-sm">{test.title}</div>
                                <div className="text-[10px] text-zinc-600 font-mono">ID: {test.id.slice(0, 8)}...</div>
                              </td>

                              <td className="py-3.5 px-4 text-zinc-300">
                                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-200">
                                  {qCount} inquiries
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-zinc-400">{test.duration_minutes}m</td>

                              <td className="py-3.5 px-4 text-zinc-400">
                                +{test.positive_marks ?? 4} / -{test.negative_marks ?? 1}
                              </td>

                              <td className="py-3.5 px-4 text-[11px] text-zinc-500">
                                {hasWindow ? (
                                  <span>
                                    {test.start_time ? new Date(test.start_time).toLocaleDateString() : "Now"} –{" "}
                                    {test.end_time ? new Date(test.end_time).toLocaleDateString() : "Open"}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">Unrestricted</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePublish(test)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    isPublished
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"
                                  }`}
                                  title="Click to toggle publish status"
                                >
                                  {isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  <span>{isPublished ? "PUBLISHED" : "DRAFT"}</span>
                                </button>
                              </td>

                              <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedTestId(test.id);
                                    setActiveTab("questions");
                                    window.location.hash = "questions";
                                  }}
                                  className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-none"
                                  title="Manage Questions"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 mr-1" />
                                  <span>Questions</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenEditTest(test)}
                                  className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-none"
                                  title="Edit Test Settings"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicateTest(test)}
                                  className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-none"
                                  title="Duplicate Test Series"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeletingTest(test)}
                                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-none"
                                  title="Delete Test Series"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: QUESTION STUDIO (WITH LIVE LATEX PREVIEW) */}
        {/* ============================================================ */}
        {activeTab === "questions" && (
          <div id="questions" className="space-y-8">
            {/* Target Test Series Selector Bar */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Active Examination Context
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="bg-black border border-zinc-700 text-white font-mono text-sm px-3 py-2 rounded-none min-w-[280px]"
                  >
                    <option value="" disabled>-- Select a test series --</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.questions?.length ?? 0} Qs) {t.is_published === false ? "[DRAFT]" : ""}
                      </option>
                    ))}
                  </select>

                  {currentSelectedTest && (
                    <span className="text-xs font-mono text-zinc-400">
                      Duration: {currentSelectedTest.duration_minutes}m | +{currentSelectedTest.positive_marks ?? 4}/-
                      {currentSelectedTest.negative_marks ?? 1}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    handleCancelQuestionEdit();
                    questionFormRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-none bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold uppercase tracking-wider h-9"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Draft New Question</span>
                </Button>
              </div>
            </div>

            {/* Question Builder Form & Real-time Live LaTeX Preview */}
            <div ref={questionFormRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Input Form (7 cols) */}
              <Card className="lg:col-span-7 bg-zinc-950 border-zinc-800 rounded-none shadow-none">
                <CardHeader className="border-b border-zinc-900 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-zinc-400" />
                        <span>{editingQuestionId ? "Editing Question" : "Question Builder"}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        Craft questions with LaTeX math formulas, options, metadata & explanations.
                      </CardDescription>
                    </div>

                    {editingQuestionId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelQuestionEdit}
                        className="h-7 text-xs font-mono rounded-none border-zinc-800"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  <form onSubmit={handleSaveQuestion} className="space-y-4">
                    {/* Statement */}
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase font-mono text-zinc-400 flex items-center justify-between">
                        <span>Statement (LaTeX syntax supported: $...$ or $$...$$)</span>
                        <span className="text-zinc-600 text-[10px]">Markdown & Math</span>
                      </Label>
                      <textarea
                        required
                        rows={4}
                        placeholder="e.g. Let $A$ be a $3 \times 3$ real symmetric matrix with eigenvalues $\lambda_1, \lambda_2, \lambda_3$. Determine $\det(\exp(A))$."
                        value={manualStatement}
                        onChange={(e) => setManualStatement(e.target.value)}
                        className="w-full bg-black border border-zinc-800 p-3 text-sm text-white font-mono rounded-none focus:outline-none focus:border-zinc-500 leading-relaxed"
                      />
                    </div>

                    {/* Metadata Strip: Topic, Difficulty, Diagram */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-black border border-zinc-900">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-mono uppercase text-zinc-500">Topic Area</Label>
                        <Input
                          placeholder="Calculus, Linear Algebra..."
                          value={questionTopic}
                          onChange={(e) => setQuestionTopic(e.target.value)}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs rounded-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-mono uppercase text-zinc-500">Difficulty</Label>
                        <select
                          value={questionDifficulty}
                          onChange={(e) => setQuestionDifficulty(e.target.value as typeof questionDifficulty)}
                          className="w-full h-8 bg-zinc-950 border border-zinc-800 text-xs font-mono px-2 text-white rounded-none"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-mono uppercase text-zinc-500">Diagram / Image</Label>
                        <div className="flex gap-1">
                          <Input
                            placeholder="Image URL or upload"
                            value={questionImageUrl}
                            onChange={(e) => setQuestionImageUrl(e.target.value)}
                            className="h-8 bg-zinc-950 border-zinc-800 text-xs rounded-none font-mono"
                          />
                          <label className="h-8 px-2 bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-800 text-zinc-400">
                            <Upload className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Options A - D */}
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs uppercase font-mono text-zinc-400">
                        Answer Choices (LaTeX supported)
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                            <span>Option A</span>
                            {correctIndex === "0" && <span className="text-emerald-400 font-bold">CORRECT</span>}
                          </div>
                          <Input
                            required
                            value={optA}
                            onChange={(e) => setOptA(e.target.value)}
                            placeholder="$\exp(\mathrm{tr}(A))$"
                            className="bg-black border-zinc-800 rounded-none text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                            <span>Option B</span>
                            {correctIndex === "1" && <span className="text-emerald-400 font-bold">CORRECT</span>}
                          </div>
                          <Input
                            required
                            value={optB}
                            onChange={(e) => setOptB(e.target.value)}
                            placeholder="$\\mathrm{tr}(\\exp(A))$"
                            className="bg-black border-zinc-800 rounded-none text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                            <span>Option C</span>
                            {correctIndex === "2" && <span className="text-emerald-400 font-bold">CORRECT</span>}
                          </div>
                          <Input
                            required
                            value={optC}
                            onChange={(e) => setOptC(e.target.value)}
                            placeholder="$\\det(A)$"
                            className="bg-black border-zinc-800 rounded-none text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                            <span>Option D</span>
                            {correctIndex === "3" && <span className="text-emerald-400 font-bold">CORRECT</span>}
                          </div>
                          <Input
                            required
                            value={optD}
                            onChange={(e) => setOptD(e.target.value)}
                            placeholder="$0$"
                            className="bg-black border-zinc-800 rounded-none text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Correct Option Selector */}
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs uppercase font-mono text-zinc-400">Designated Correct Choice</Label>
                      <select
                        value={correctIndex}
                        onChange={(e) => setCorrectIndex(e.target.value)}
                        className="w-full h-10 bg-black border border-zinc-800 px-3 text-sm text-white font-mono rounded-none"
                      >
                        <option value="0">Option A</option>
                        <option value="1">Option B</option>
                        <option value="2">Option C</option>
                        <option value="3">Option D</option>
                      </select>
                    </div>

                    {/* Solution */}
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs uppercase font-mono text-zinc-400">
                        Official Solution & KaTeX Proof
                      </Label>
                      <textarea
                        rows={3}
                        placeholder="Detailed derivation shown to students upon submission..."
                        value={manualSolution}
                        onChange={(e) => setManualSolution(e.target.value)}
                        className="w-full bg-black border border-zinc-800 p-3 text-sm text-white font-mono rounded-none focus:outline-none focus:border-zinc-500 leading-relaxed"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSavingQuestion || !selectedTestId}
                      className="w-full h-11 rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase tracking-wider"
                    >
                      {isSavingQuestion
                        ? "PERSISTING QUESTION..."
                        : editingQuestionId
                        ? "SAVE QUESTION UPDATES"
                        : "ADD QUESTION TO ACTIVE TEST"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Right Column: Live Real-Time LaTeX Preview Panel (5 cols) */}
              <Card className="lg:col-span-5 bg-zinc-950 border-zinc-800 rounded-none shadow-none flex flex-col justify-between">
                <div>
                  <CardHeader className="border-b border-zinc-900 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-zinc-400" />
                        <span>Live Student View Preview</span>
                      </CardTitle>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400">
                        KaTeX Active
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Meta Pills */}
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300">
                        Topic: {questionTopic || "General"}
                      </span>
                      <span
                        className={`px-2 py-0.5 border font-bold uppercase ${
                          questionDifficulty === "easy"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : questionDifficulty === "hard"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {questionDifficulty}
                      </span>
                    </div>

                    {/* Statement Preview */}
                    <div className="p-4 bg-black border border-zinc-800 rounded-none min-h-[90px] text-zinc-100 text-base leading-relaxed space-y-2">
                      {manualStatement.trim() ? (
                        <Latex>{manualStatement}</Latex>
                      ) : (
                        <span className="text-zinc-600 italic text-xs">
                          Statement preview will render here in real-time as you type LaTeX formulas...
                        </span>
                      )}

                      {questionImageUrl && (
                        <div className="pt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={questionImageUrl}
                            alt="Question Diagram Preview"
                            className="max-h-48 max-w-full object-contain border border-zinc-800 bg-zinc-950"
                          />
                        </div>
                      )}
                    </div>

                    {/* Options Preview */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Choices Preview:</div>
                      <div className="space-y-1.5">
                        {[
                          { char: "A", val: optA, idx: "0" },
                          { char: "B", val: optB, idx: "1" },
                          { char: "C", val: optC, idx: "2" },
                          { char: "D", val: optD, idx: "3" },
                        ].map(({ char, val, idx }) => {
                          const isCorrect = correctIndex === idx;
                          return (
                            <div
                              key={char}
                              className={`p-2.5 text-xs border rounded-none flex items-start gap-3 ${
                                isCorrect
                                  ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-200"
                                  : "border-zinc-800 bg-black text-zinc-400"
                              }`}
                            >
                              <span
                                className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border ${
                                  isCorrect
                                    ? "bg-emerald-500 text-black border-emerald-400"
                                    : "border-zinc-800 bg-zinc-900 text-zinc-400"
                                }`}
                              >
                                {char}
                              </span>
                              <div className="flex-1 overflow-x-auto">
                                {val.trim() ? (
                                  <Latex>{val}</Latex>
                                ) : (
                                  <span className="text-zinc-700 italic">Empty option</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Solution Preview */}
                    {manualSolution.trim() && (
                      <div className="space-y-1 pt-2 border-t border-zinc-900">
                        <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Solution Proof Preview:</div>
                        <div className="p-3 bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-mono">
                          <Latex>{manualSolution}</Latex>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            </div>

            {/* Existing Questions Table */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-zinc-400" />
                      <span>Existing Questions in Active Test ({questions.length})</span>
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      All active inquiries configured for &quot;{currentSelectedTest?.title || "Selected Test"}&quot;.
                    </CardDescription>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-zinc-500" />
                    <Input
                      placeholder="Search questions by text/topic..."
                      value={questionSearchTerm}
                      onChange={(e) => setQuestionSearchTerm(e.target.value)}
                      className="pl-8 bg-black border-zinc-800 rounded-none text-xs h-9"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isQuestionsLoading ? (
                  <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                    Loading inquiries from database...
                  </div>
                ) : questions.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600 font-mono text-xs">
                    No questions added to this test series yet. Use the Question Builder above or Excel Bulk Upload.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest bg-zinc-950">
                          <th className="py-3 px-4 w-12">#</th>
                          <th className="py-3 px-4">Statement Snippet</th>
                          <th className="py-3 px-4">Topic</th>
                          <th className="py-3 px-4">Difficulty</th>
                          <th className="py-3 px-4">Correct Choice</th>
                          <th className="py-3 px-4">Diagram</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {questions
                          .filter(
                            (q) =>
                              q.statement.toLowerCase().includes(questionSearchTerm.toLowerCase()) ||
                              (q.topic || "").toLowerCase().includes(questionSearchTerm.toLowerCase())
                          )
                          .map((q, idx) => {
                            const optionLabels = ["A", "B", "C", "D"];
                            return (
                              <tr key={q.id} className="hover:bg-zinc-900/40 transition-colors">
                                <td className="py-3.5 px-4 text-zinc-500 font-bold">{idx + 1}</td>
                                <td className="py-3.5 px-4 font-sans text-zinc-200 max-w-md">
                                  <div className="line-clamp-2">
                                    <Latex>{q.statement}</Latex>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-zinc-400">
                                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800">
                                    {q.topic || "General"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                                      q.difficulty === "easy"
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                        : q.difficulty === "hard"
                                        ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                    }`}
                                  >
                                    {q.difficulty || "medium"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-bold">
                                    Option {optionLabels[q.correct_option_index] || "A"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-zinc-500">
                                  {q.image_url ? (
                                    <span className="text-blue-400 text-[11px] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Yes
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditQuestionClick(q)}
                                    className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-none"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                                    <span>Edit</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-none"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: EXCEL BULK IMPORT STUDIO */}
        {/* ============================================================ */}
        {activeTab === "bulk" && (
          <div id="bulk" className="space-y-8">
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-zinc-400" />
                      <span>Excel Bulk Question Import Studio</span>
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Batch upload questions from spreadsheet with client-side syntax validation, error preview, and one-click import.
                    </CardDescription>
                  </div>

                  <Button
                    onClick={handleDownloadTemplate}
                    variant="outline"
                    className="rounded-none border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-white hover:text-black font-mono text-xs uppercase tracking-wider flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .xlsx Template</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* Active Test Selector for Bulk Import */}
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-mono text-zinc-400">
                    Target Test Series for Imported Questions
                  </Label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full flex h-11 border border-zinc-700 bg-black px-4 py-2 text-sm rounded-none text-white font-mono"
                  >
                    <option value="" disabled>-- Select target examination --</option>
                    {tests.map((test) => (
                      <option key={test.id} value={test.id}>
                        {test.title} (Currently has {test.questions?.length ?? 0} questions)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Upload Zone */}
                <div className="border border-dashed border-zinc-800 bg-black p-8 text-center space-y-3">
                  <Upload className="w-8 h-8 text-zinc-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">Select populated questions spreadsheet (.xlsx, .xls)</p>
                    <p className="text-xs text-zinc-500">
                      Columns supported: Question, Option A, Option B, Option C, Option D, Correct Answer, Solution, Topic, Difficulty, Image URL
                    </p>
                  </div>

                  <input
                    ref={bulkFileRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileSelect}
                    className="block w-full max-w-xs mx-auto text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-mono file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer"
                  />
                </div>

                {/* Import Status Alert */}
                {bulkSummary && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{bulkSummary}</span>
                  </div>
                )}

                {/* Validation Preview Table */}
                {bulkRows.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-zinc-900">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-white">
                          Parsed: {bulkRows.length} Rows
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          {bulkRows.filter((r) => r.isValid).length} Valid
                        </span>
                        {bulkRows.some((r) => !r.isValid) && (
                          <span className="text-xs font-mono px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400">
                            {bulkRows.filter((r) => !r.isValid).length} Errors
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleImportValidBulkRows}
                          disabled={isUploadingBulk || bulkRows.filter((r) => r.isValid).length === 0}
                          className="h-10 rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider"
                        >
                          {isUploadingBulk
                            ? "IMPORTING QUESTIONS..."
                            : `IMPORT ${bulkRows.filter((r) => r.isValid).length} VALID QUESTIONS`}
                        </Button>
                      </div>
                    </div>

                    <div className="border border-zinc-800 max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead className="sticky top-0 bg-zinc-950 z-10 border-b border-zinc-800">
                          <tr className="text-zinc-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Row</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Question Statement</th>
                            <th className="py-2.5 px-3">Ans</th>
                            <th className="py-2.5 px-3">Topic</th>
                            <th className="py-2.5 px-3">Validation Diagnostic</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {bulkRows.map((row) => (
                            <tr
                              key={row.index}
                              className={row.isValid ? "hover:bg-zinc-900/30" : "bg-red-950/20 text-red-300"}
                            >
                              <td className="py-2 px-3 text-zinc-500 font-bold">{row.index}</td>
                              <td className="py-2 px-3">
                                {row.isValid ? (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                    READY
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/40">
                                    INVALID
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-sans max-w-sm truncate text-zinc-300">
                                {row.statement || <span className="text-red-400">[Missing Question]</span>}
                              </td>
                              <td className="py-2 px-3 font-bold text-white">{row.correctChar || "—"}</td>
                              <td className="py-2 px-3 text-zinc-400">{row.topic}</td>
                              <td className="py-2 px-3 text-[11px] text-zinc-400">
                                {row.isValid ? (
                                  <span className="text-emerald-500">All columns validated</span>
                                ) : (
                                  <span className="text-red-400 font-bold">{row.error}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: STUDENT DIRECTORY & SCORECARDS */}
        {/* ============================================================ */}
        {activeTab === "students" && (
          <div id="students" className="space-y-8">
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Enrolled Students
                </span>
                <span className="text-3xl font-black font-mono text-white mt-1 block">
                  {students.length}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Lifetime Submissions
                </span>
                <span className="text-3xl font-black font-mono text-white mt-1 block">
                  {allResults.length}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-5">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest block">
                  Cohort Average Score
                </span>
                <span className="text-3xl font-black font-mono text-emerald-400 mt-1 block">
                  {analyticsStats.avg} pts
                </span>
              </Card>
            </div>

            {/* Students Table */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-zinc-400" />
                      <span>Student Roster ({aggregatedStudents.length})</span>
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Inspect registered student attempts, aggregate performance metrics, and individual exam scorecards.
                    </CardDescription>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-zinc-500" />
                    <Input
                      placeholder="Search by student email..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="pl-8 bg-black border-zinc-800 rounded-none text-xs h-9"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest bg-zinc-950">
                        <th className="py-3 px-4">Student Profile</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Tests Taken</th>
                        <th className="py-3 px-4">Average Score</th>
                        <th className="py-3 px-4">Peak Score</th>
                        <th className="py-3 px-4">Last Activity</th>
                        <th className="py-3 px-4 text-right">Scorecards</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {aggregatedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-600">
                            No student profiles found matching your search.
                          </td>
                        </tr>
                      ) : (
                        aggregatedStudents.map((item) => (
                          <tr key={item.profile.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3.5 px-4 font-sans font-bold text-white">
                              <div>{item.profile.full_name || item.profile.email.split("@")[0]}</div>
                              <div className="text-[11px] text-zinc-400 font-normal">{item.profile.email}</div>
                              <div className="text-[10px] text-zinc-600 font-mono">ID: {item.profile.id.slice(0, 8)}...</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  item.profile.role === "admin"
                                    ? "bg-purple-950/40 text-purple-400 border border-purple-700/50"
                                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                                }`}
                              >
                                {item.profile.role || "student"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-zinc-300 font-bold">
                              {item.totalAttempts} {item.totalAttempts === 1 ? "exam" : "exams"}
                            </td>

                            <td className="py-3.5 px-4 font-mono font-bold text-white">
                              {item.totalAttempts > 0 ? `${item.avgScore} pts` : "—"}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                              {item.totalAttempts > 0 ? `${item.bestScore} pts` : "—"}
                            </td>

                            <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                              {item.lastActive !== "N/A"
                                ? new Date(item.lastActive).toLocaleDateString()
                                : "No activity"}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedStudentDrilldown({ profile: item.profile, results: item.results })}
                                className="h-8 px-3 rounded-none border-zinc-700 bg-zinc-900 text-xs font-bold hover:bg-white hover:text-black font-mono uppercase"
                              >
                                View History ({item.totalAttempts})
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
        )}

        {/* ============================================================ */}
        {/* TAB 5: ANALYTICS & CSV EXPORT */}
        {/* ============================================================ */}
        {activeTab === "analytics" && (
          <div id="analytics" className="space-y-8">
            {/* Filter & Export Bar */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 uppercase font-bold">Scope Test:</span>
                <select
                  value={analyticsTestFilter}
                  onChange={(e) => setAnalyticsTestFilter(e.target.value)}
                  className="bg-black border border-zinc-700 text-white font-mono text-xs px-3 py-2 rounded-none min-w-[240px]"
                >
                  <option value="all">All Examinations (Aggregate)</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleExportCSV}
                className="rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-wider h-9 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Submissions (.CSV)</span>
              </Button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Attempts</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {analyticsStats.total}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Mean Score</span>
                <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
                  {analyticsStats.avg}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Peak Score</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {analyticsStats.max}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Lowest Score</span>
                <span className="text-2xl font-black font-mono text-zinc-400 mt-1 block">
                  {analyticsStats.min}
                </span>
              </Card>

              <Card className="bg-zinc-950 border-zinc-800 rounded-none p-4 col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Cohort Accuracy</span>
                <span className="text-2xl font-black font-mono text-cyan-400 mt-1 block">
                  {analyticsStats.accuracy}%
                </span>
              </Card>
            </div>

            {/* Visual Score Distribution Histogram */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-3">
                <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-300">
                  Cohort Score Distribution Histogram
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Frequency of attempts segmented into quartile score brackets.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-4 h-44 items-end p-4 bg-black border border-zinc-900">
                  {[
                    { label: "0% - 25%", count: scoreDistribution[0] },
                    { label: "26% - 50%", count: scoreDistribution[1] },
                    { label: "51% - 75%", count: scoreDistribution[2] },
                    { label: "76% - 100%", count: scoreDistribution[3] },
                  ].map((bar, idx) => {
                    const maxCount = Math.max(...scoreDistribution, 1);
                    const heightPct = Math.round((bar.count / maxCount) * 100);

                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                        <span className="font-mono text-xs font-bold text-white">{bar.count}</span>
                        <div
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          className={`w-full transition-all duration-300 ${
                            idx === 3
                              ? "bg-emerald-500"
                              : idx === 2
                              ? "bg-cyan-500"
                              : idx === 1
                              ? "bg-amber-500"
                              : "bg-zinc-700"
                          }`}
                        />
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{bar.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Live Submissions Feed */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-4">
                <CardTitle className="text-lg font-bold text-white">
                  Live Submissions Log ({filteredResults.length})
                </CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  Chronological submission stream with instant scorecard inspector.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest bg-zinc-950">
                        <th className="py-3 px-4">Test Title</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Attempted</th>
                        <th className="py-3 px-4">Correct</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-zinc-600">
                            No student test submissions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        filteredResults.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3.5 px-4 font-sans font-bold text-white">
                              {item.tests?.title || "Unknown Test"}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white">{item.score} pts</td>
                            <td className="py-3.5 px-4 text-zinc-300">{item.total_attempted}</td>
                            <td className="py-3.5 px-4 text-emerald-400 font-bold">{item.total_correct}</td>
                            <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                              {new Date(item.created_at).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => router.push(`/results?resultId=${item.id}`)}
                                className="h-7 px-3 rounded-none bg-zinc-900 border border-zinc-700 text-[11px] font-bold hover:bg-white hover:text-black font-mono uppercase"
                              >
                                INSPECT
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
        )}

        {/* ============================================================ */}
        {/* MODAL: EDIT TEST SERIES */}
        {/* ============================================================ */}
        {editingTest && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg p-6 space-y-5 rounded-none shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-base font-bold text-white font-mono uppercase">
                  Edit Test Series Settings
                </h3>
                <button
                  onClick={() => setEditingTest(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditTest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-mono text-zinc-400">Test Title</Label>
                  <Input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-black border-zinc-800 rounded-none text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-mono text-zinc-400">Duration (m)</Label>
                    <Input
                      type="number"
                      required
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="bg-black border-zinc-800 rounded-none font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-mono text-zinc-400">Correct (+)</Label>
                    <Input
                      type="number"
                      step="any"
                      required
                      value={editPositiveMarks}
                      onChange={(e) => setEditPositiveMarks(e.target.value)}
                      className="bg-black border-zinc-800 rounded-none font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-mono text-zinc-400">Wrong (-)</Label>
                    <Input
                      type="number"
                      step="any"
                      required
                      value={editNegativeMarks}
                      onChange={(e) => setEditNegativeMarks(e.target.value)}
                      className="bg-black border-zinc-800 rounded-none font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-mono text-zinc-400">Window Start</Label>
                    <Input
                      type="datetime-local"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="bg-black border-zinc-800 rounded-none font-mono text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-mono text-zinc-400">Window End</Label>
                    <Input
                      type="datetime-local"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="bg-black border-zinc-800 rounded-none font-mono text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-mono uppercase text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsPublished}
                      onChange={(e) => setEditIsPublished(e.target.checked)}
                      className="rounded-none border-zinc-700 bg-black text-white focus:ring-0"
                    />
                    <span>Published (Visible to students)</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingTest(null)}
                    className="rounded-none border-zinc-800 text-xs font-mono"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-none bg-white text-black hover:bg-zinc-200 font-bold font-mono text-xs uppercase"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: DELETE TEST CONFIRMATION */}
        {/* ============================================================ */}
        {deletingTest && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-red-900/50 w-full max-w-md p-6 space-y-4 rounded-none shadow-2xl">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold font-mono uppercase tracking-wider text-white">
                  Confirm Test Deletion
                </h3>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Are you sure you want to permanently delete{" "}
                <span className="text-white font-bold">&quot;{deletingTest.title}&quot;</span>? All associated
                questions and inquiries within this series will be destroyed. This action cannot be reversed.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-900">
                <Button
                  variant="outline"
                  onClick={() => setDeletingTest(null)}
                  className="rounded-none border-zinc-800 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteTest}
                  className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold font-mono text-xs uppercase"
                >
                  DELETE TEST PERMANENTLY
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: STUDENT DRILLDOWN SCORECARDS */}
        {/* ============================================================ */}
        {selectedStudentDrilldown && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-none shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-zinc-900">
                <div>
                  <h3 className="text-base font-bold text-white font-mono uppercase">
                    Student Scorecards & History
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono">
                    {selectedStudentDrilldown.profile.email} (ID: {selectedStudentDrilldown.profile.id})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStudentDrilldown(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {selectedStudentDrilldown.results.length === 0 ? (
                  <p className="text-center py-8 text-zinc-600 font-mono text-xs">
                    This student has not submitted any exam attempts yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedStudentDrilldown.results.map((res) => (
                      <div
                        key={res.id}
                        className="p-4 bg-black border border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white font-sans">
                            {res.tests?.title || "Test Series"}
                          </h4>
                          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                            <span>Score: <strong className="text-white">{res.score} pts</strong></span>
                            <span>Attempted: {res.total_attempted}</span>
                            <span>Correct: <strong className="text-green-400">{res.total_correct}</strong></span>
                            <span className="text-zinc-600">
                              {new Date(res.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedStudentDrilldown(null);
                            router.push(`/results?resultId=${res.id}`);
                          }}
                          className="h-8 px-3 rounded-none bg-zinc-900 border border-zinc-700 text-xs font-bold hover:bg-white hover:text-black font-mono uppercase shrink-0 flex items-center gap-1"
                        >
                          <span>Review Exam</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-900 flex justify-end">
                <Button
                  onClick={() => setSelectedStudentDrilldown(null)}
                  className="rounded-none bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase"
                >
                  Close Drawer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}