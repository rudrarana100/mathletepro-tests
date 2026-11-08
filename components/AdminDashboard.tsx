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
import MathRenderer from "@/components/MathRenderer";
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
  AlertTriangle,
  BarChart3,
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
  options: string;
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
  answers?: Record<string, string | number>;
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

interface QuestionAnalytics {
  question: Question;
  totalSubmissions: number;
  attemptedCount: number;
  correctCount: number;
  missCount: number;
  missRate: number;
  accuracyRate: number;
  difficultyIndicator: "easy" | "medium" | "hard";
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

  // Analytics State
  const [analyticsTestFilter, setAnalyticsTestFilter] = useState("all");
  const [analyticsQuestions, setAnalyticsQuestions] = useState<Question[]>([]);
  const [isAnalyticsQuestionsLoading, setIsAnalyticsQuestionsLoading] = useState(false);

  // Section C.3: Format dates as "7 Nov 2026"
  const formatDate = useCallback((dateStr?: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  // ================================================================
  // Data Fetching (Parallel Promise.all)
  // ================================================================

  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      let loadedTests: Test[] = [];
      let loadedResults: TestResultRecord[] = [];

      try {
        const [testRes, resultsRes, profileRes] = await Promise.all([
          supabase
            .from("tests")
            .select("id, title, duration_minutes, positive_marks, negative_marks, is_published, start_time, end_time, created_at, questions(id)")
            .order("created_at", { ascending: false }),
          supabase
            .from("test_results")
            .select("id, student_id, test_id, score, total_attempted, total_correct, answers, created_at, tests(title)")
            .order("created_at", { ascending: false }),
          supabase
            .from("profiles")
            .select("id, email, role, full_name, created_at")
            .order("created_at", { ascending: false }),
        ]);

        if (!testRes.error && testRes.data) {
          loadedTests = testRes.data as unknown as Test[];
        }
        if (!resultsRes.error && resultsRes.data) {
          loadedResults = resultsRes.data as unknown as TestResultRecord[];
        }
        if (!profileRes.error && profileRes.data) {
          setStudents(profileRes.data as StudentProfile[]);
        }
      } catch {
        // Fallback if offline
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

  // Fetch questions for analytics when a specific test is scoped
  useEffect(() => {
    if (!analyticsTestFilter || analyticsTestFilter === "all") {
      setAnalyticsQuestions([]);
      return;
    }

    let isMounted = true;
    setIsAnalyticsQuestionsLoading(true);

    const loadScopeQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from("questions")
          .select("id, test_id, statement, options, correct_option_index, solution, topic, difficulty, image_url, created_at")
          .eq("test_id", analyticsTestFilter)
          .order("created_at", { ascending: true });

        if (isMounted) {
          if (!error && data) {
            setAnalyticsQuestions(data as Question[]);
          } else {
            setAnalyticsQuestions([]);
          }
        }
      } catch {
        if (isMounted) setAnalyticsQuestions([]);
      } finally {
        if (isMounted) setIsAnalyticsQuestionsLoading(false);
      }
    };

    loadScopeQuestions();

    return () => {
      isMounted = false;
    };
  }, [analyticsTestFilter, supabase]);

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

  // Fast student email lookup map
  const studentMap = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => map.set(s.id, s.email));
    return map;
  }, [students]);

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
      success(`Test series "${payload.title}" created successfully.`);
    } catch (err) {
      toastError("Failed to create test: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsCreatingTest(false);
    }
  };

  const handleTogglePublish = async (test: Test) => {
    const qCount = test.questions?.length ?? 0;
    const nextState = !(test.is_published ?? true);

    // Section B.1: Tests with 0 questions must not be publishable
    if (nextState === true && qCount === 0) {
      toastError("Cannot publish a test with 0 questions. Add at least one question first.");
      return;
    }

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
      success(`"${test.title}" is now ${nextState ? "published" : "in draft mode"}.`);
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

    const qCount = editingTest.questions?.length ?? 0;
    if (editIsPublished && qCount === 0) {
      toastError("Cannot publish a test with 0 questions. Add at least one question first.");
      return;
    }

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
      success("Test settings updated successfully.");
    } catch (err) {
      toastError("Failed to update test: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDuplicateTest = async (test: Test) => {
    if (!confirm(`Duplicate test "${test.title}" along with all its questions?`)) return;

    try {
      const { data: newTest, error: testErr } = await supabase
        .from("tests")
        .insert([
          {
            title: `${test.title} (Copy)`,
            duration_minutes: test.duration_minutes,
            positive_marks: test.positive_marks ?? 4,
            negative_marks: test.negative_marks ?? 1,
            is_published: false,
            start_time: test.start_time,
            end_time: test.end_time,
          },
        ])
        .select()
        .single();

      if (testErr || !newTest) throw testErr || new Error("Could not clone test");

      const { data: origQuestions } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", test.id);

      if (origQuestions && origQuestions.length > 0) {
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
      success(`Cloned "${test.title}" into a new draft test.`);
    } catch (err) {
      toastError("Failed to duplicate test: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDeleteTest = async () => {
    if (!deletingTest) return;

    try {
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
      toastError("Please select a target test series first.");
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
        const { error } = await supabase
          .from("questions")
          .update(payload)
          .eq("id", editingQuestionId);

        if (error) throw error;
        success("Question updated successfully.");
      } else {
        const { error } = await supabase.from("questions").insert([payload]);
        if (error) throw error;
        success("Question added to test series.");
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      // Storage bucket fallback
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

    const XLSX = await import("xlsx");
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
    reader.onload = async (event) => {
      try {
        const XLSX = await import("xlsx");
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
      toastError("Please select a target test series first.");
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

  // Section B.2: Exclude admin accounts from all student analytics
  const studentResults = useMemo(() => {
    const adminIds = new Set(students.filter((s) => s.role === "admin").map((s) => s.id));
    return allResults.filter((r) => !adminIds.has(r.student_id));
  }, [allResults, students]);

  const filteredResults = useMemo(() => {
    if (analyticsTestFilter === "all") return studentResults;
    return studentResults.filter((r) => r.test_id === analyticsTestFilter);
  }, [studentResults, analyticsTestFilter]);

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

  // Per-Question Miss Rate Breakdown for Scoped Test (excluding admin attempts)
  const questionAnalyticsList = useMemo<QuestionAnalytics[]>(() => {
    if (analyticsTestFilter === "all" || analyticsQuestions.length === 0) {
      return [];
    }

    const testSubmissions = studentResults.filter((r) => r.test_id === analyticsTestFilter);
    const totalSubs = testSubmissions.length;

    return analyticsQuestions.map((q) => {
      let attempted = 0;
      let correct = 0;

      testSubmissions.forEach((res) => {
        const rawAns = res.answers?.[q.id];
        if (rawAns !== undefined && rawAns !== null && rawAns !== "") {
          attempted += 1;
          if (Number(rawAns) === q.correct_option_index) {
            correct += 1;
          }
        }
      });

      const missCount = totalSubs > 0 ? totalSubs - correct : 0;
      const missRate = totalSubs > 0 ? Math.round((missCount / totalSubs) * 100) : 0;
      const accuracyRate = totalSubs > 0 ? Math.round((correct / totalSubs) * 100) : 0;

      let difficultyIndicator: "easy" | "medium" | "hard" = "medium";
      if (missRate >= 60) {
        difficultyIndicator = "hard";
      } else if (missRate < 35) {
        difficultyIndicator = "easy";
      }

      return {
        question: q,
        totalSubmissions: totalSubs,
        attemptedCount: attempted,
        correctCount: correct,
        missCount,
        missRate,
        accuracyRate,
        difficultyIndicator,
      };
    }).sort((a, b) => b.missRate - a.missRate);
  }, [analyticsTestFilter, analyticsQuestions, studentResults]);

  const mostMissedQuestion = useMemo(() => {
    if (questionAnalyticsList.length === 0 || questionAnalyticsList[0].totalSubmissions === 0) {
      return null;
    }
    return questionAnalyticsList[0];
  }, [questionAnalyticsList]);

  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      toastError("No attempt results found to export.");
      return;
    }

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
    studentResults.forEach((r) => {
      const arr = studentResultsMap.get(r.student_id) || [];
      arr.push(r);
      studentResultsMap.set(r.student_id, arr);
    });

    // Section B.2: Exclude admin accounts from student analytics & roster
    const list = students.filter((s) => s.role !== "admin").map((s) => {
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
      <div className="flex h-screen items-center justify-center bg-black text-zinc-400 font-normal text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-zinc-500" />
        Loading dashboard...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header (Section C.1 & C.2) */}
      <PageHeader
        title="Dashboard"
        breadcrumbs={[
          { label: "Mathlete", href: "/admin" },
          { label: "Dashboard" },
        ]}
      />

      {/* ============================================================ */}
      {/* TAB 0: OVERVIEW */}
      {/* ============================================================ */}
      {activeTab === "overview" && (
        <div id="overview" className="space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Total students
              </span>
              <span className="text-2xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {students.filter((s) => s.role !== "admin").length}
              </span>
              <span className="text-xs text-zinc-500 mt-1 block">
                Registered student accounts
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Tests published
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-semibold text-zinc-100 tabular-nums">
                  {publishedCount}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {draftCount} in draft
                </span>
              </div>
              <span className="text-xs text-zinc-500 mt-1 block">
                Across {totalQuestionsInBank} total questions
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Total attempts
              </span>
              <span className="text-2xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {studentResults.length}
              </span>
              <span className="text-xs text-zinc-500 mt-1 block">
                Total attempts
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Average score
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-semibold text-emerald-400 tabular-nums">
                  {analyticsStats.avg} pts
                </span>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {analyticsStats.accuracy}% accuracy
                </span>
              </div>
              <span className="text-xs text-zinc-500 mt-1 block">
                All students
              </span>
            </Card>
          </div>

          {/* Quick Actions Bar */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-400 font-medium">
                Quick actions:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => {
                    setActiveTab("tests");
                    window.location.hash = "tests";
                  }}
                  size="sm"
                  className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Create new test</span>
                </Button>
                <Button
                  onClick={() => {
                    setActiveTab("questions");
                    window.location.hash = "questions";
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs font-medium h-8"
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                  <span>Add questions</span>
                </Button>
                <Button
                  onClick={() => {
                    setActiveTab("analytics");
                    window.location.hash = "analytics";
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs font-medium h-8"
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  <span>View analytics</span>
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs font-medium h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* 2-Column Split: Active Tests & Recent Attempts Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Tests (7 cols) */}
            <Card className="lg:col-span-7 bg-zinc-950 border-zinc-800 rounded-md shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-zinc-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-400" />
                    <span>Tests ({tests.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Overview of active examinations and draft assessments.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActiveTab("tests");
                    window.location.hash = "tests";
                  }}
                  className="h-7 text-xs text-zinc-400 hover:text-zinc-100 rounded-md"
                >
                  <span>Manage all</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3 text-right">Questions</th>
                        <th className="py-2.5 px-3 text-right">Marking</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {tests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-zinc-500">
                            No tests created yet.
                          </td>
                        </tr>
                      ) : (
                        tests.slice(0, 6).map((test) => {
                          const isPublished = test.is_published !== false;
                          const qCount = test.questions?.length ?? 0;
                          return (
                            <tr key={test.id} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-3 font-medium text-zinc-100 max-w-[200px] truncate">
                                {test.title}
                              </td>
                              <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{qCount}</td>
                              <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">
                                +{test.positive_marks ?? 4} / -{test.negative_marks ?? 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                                    isPublished
                                      ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                      : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                                  }`}
                                >
                                  {isPublished ? "Published" : "Draft"}
                                </span>
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
                                  className="h-6 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
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

            {/* Recent Attempts Feed (5 cols, Last 10 attempts) */}
            <Card className="lg:col-span-5 bg-zinc-950 border-zinc-800 rounded-md shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-zinc-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-zinc-400" />
                    <span>Recent attempts</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Latest submissions
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActiveTab("analytics");
                    window.location.hash = "analytics";
                  }}
                  className="h-7 text-xs text-zinc-400 hover:text-zinc-100 rounded-md"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-900 max-h-[380px] overflow-y-auto">
                  {studentResults.length === 0 ? (
                    <p className="p-6 text-center text-zinc-500 text-xs">
                      No submissions recorded yet.
                    </p>
                  ) : (
                    studentResults.slice(0, 10).map((r) => {
                      const studentEmail = studentMap.get(r.student_id) || `${r.student_id.slice(0, 8)}...`;
                      return (
                        <div
                          key={r.id}
                          className="p-3 hover:bg-zinc-900/40 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-zinc-100 font-medium text-xs truncate">
                              {r.tests?.title || "Examination"}
                            </p>
                            <p className="text-zinc-500 text-[11px] truncate" title={studentEmail}>
                              {studentEmail} &middot; {formatDate(r.created_at)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-emerald-400 font-medium tabular-nums">{r.score} pts</p>
                            <button
                              onClick={() => router.push(`/results?resultId=${r.id}`)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                            >
                              Inspect
                            </button>
                          </div>
                        </div>
                      );
                    })
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
        <div id="tests" className="space-y-6">
          {/* Create Test Series Card */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-100">
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>Create new test</span>
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Set duration, custom marking scheme, and optional scheduling window.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleCreateTest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="space-y-1.5 md:col-span-5">
                    <Label className="text-xs text-zinc-400 font-medium">Test title</Label>
                    <Input
                      required
                      placeholder="e.g. Real Analysis Examination - JEE Advanced"
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-zinc-400 font-medium">Duration (minutes)</Label>
                    <Input
                      required
                      type="number"
                      min="1"
                      value={newTestDuration}
                      onChange={(e) => setNewTestDuration(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-zinc-400 font-medium">Positive (+)</Label>
                    <Input
                      required
                      type="number"
                      step="any"
                      value={newPositiveMarks}
                      onChange={(e) => setNewPositiveMarks(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-xs text-zinc-400 font-medium">Negative (-)</Label>
                    <Input
                      required
                      type="number"
                      step="any"
                      value={newNegativeMarks}
                      onChange={(e) => setNewNegativeMarks(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs tabular-nums"
                    />
                  </div>
                </div>

                {/* Scheduling & Publish toggles */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-zinc-900 items-end">
                  <div className="space-y-1.5 md:col-span-4">
                    <Label className="text-xs text-zinc-400 font-medium">
                      Scheduled start (optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-4">
                    <Label className="text-xs text-zinc-400 font-medium">
                      Scheduled end (optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 h-9">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newIsPublished}
                        onChange={(e) => setNewIsPublished(e.target.checked)}
                        className="rounded border-zinc-700 bg-black text-white focus:ring-0"
                      />
                      <span>Publish now</span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={isCreatingTest}
                      className="w-full h-9 rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium"
                    >
                      {isCreatingTest ? "Creating..." : "Create test"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Test Series Repository */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-medium text-zinc-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-400" />
                    <span>Tests ({filteredTests.length})</span>
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    Inspect existing tests, modify marking schemes, toggle live status, duplicate, or manage question banks.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                    <Input
                      placeholder="Search tests..."
                      value={testSearchTerm}
                      onChange={(e) => setTestSearchTerm(e.target.value)}
                      className="pl-8 bg-black border-zinc-800 rounded-md text-xs h-8"
                    />
                  </div>

                  <select
                    value={testFilterStatus}
                    onChange={(e) => setTestFilterStatus(e.target.value as typeof testFilterStatus)}
                    className="bg-black border border-zinc-800 text-xs px-2.5 h-8 text-zinc-300 rounded-md"
                  >
                    <option value="all">All statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts only</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                      <th className="py-3 px-4">Title & Context</th>
                      <th className="py-3 px-4 text-right">Questions</th>
                      <th className="py-3 px-4 text-right">Duration</th>
                      <th className="py-3 px-4 text-right">Marking</th>
                      <th className="py-3 px-4">Window</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {filteredTests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
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
                            <td className="py-3.5 px-4 font-medium text-zinc-100 max-w-xs">
                              <div className="truncate text-xs font-semibold">{test.title}</div>
                              <div className="text-[11px] text-zinc-500 font-normal">
                                Created {formatDate(test.created_at)}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right text-zinc-300 tabular-nums">
                              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-sm text-zinc-300">
                                {qCount} questions
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums">{test.duration_minutes}m</td>

                            <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums">
                              +{test.positive_marks ?? 4} / -{test.negative_marks ?? 1}
                            </td>

                            <td className="py-3.5 px-4 text-[11px] text-zinc-400">
                              {hasWindow ? (
                                <span>
                                  {test.start_time ? formatDate(test.start_time) : "Now"} –{" "}
                                  {test.end_time ? formatDate(test.end_time) : "Open"}
                                </span>
                              ) : (
                                <span className="text-zinc-500">Unrestricted</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                disabled={qCount === 0 && !isPublished}
                                onClick={() => handleTogglePublish(test)}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-medium transition-colors ${
                                  qCount === 0 && !isPublished
                                    ? "border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed opacity-60"
                                    : isPublished
                                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                                }`}
                                title={
                                  qCount === 0 && !isPublished
                                    ? "Add at least one question before publishing"
                                    : "Click to toggle publish status"
                                }
                              >
                                {isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{isPublished ? "Published" : "Draft"}</span>
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
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
                                title="Manage Questions"
                              >
                                <HelpCircle className="w-3.5 h-3.5 mr-1" />
                                <span>Questions</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAnalyticsTestFilter(test.id);
                                  setActiveTab("analytics");
                                  window.location.hash = "analytics";
                                }}
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
                                title="View analytics for this test"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditTest(test)}
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
                                title="Edit test settings"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDuplicateTest(test)}
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
                                title="Duplicate test"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingTest(test)}
                                className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-md"
                                title="Delete test"
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
      {/* TAB 2: QUESTION STUDIO (WITH LIVE MATHRENDERER PREVIEW) */}
      {/* ============================================================ */}
      {activeTab === "questions" && (
        <div id="questions" className="space-y-6">
          {/* Target Test Series Selector Bar */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-medium block">
                Active examination context
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="bg-black border border-zinc-700 text-zinc-100 text-xs px-3 py-1.5 rounded-md min-w-[280px]"
                >
                  <option value="" disabled>-- Select a test series --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.questions?.length ?? 0} Qs) {t.is_published === false ? "[Draft]" : ""}
                    </option>
                  ))}
                </select>

                {currentSelectedTest && (
                  <span className="text-xs text-zinc-500 tabular-nums">
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
                className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Draft new question</span>
              </Button>
            </div>
          </div>

          {/* Question Builder Form & Real-time Live Math Preview */}
          <div ref={questionFormRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Input Form (7 cols) */}
            <Card className="lg:col-span-7 bg-zinc-950 border-zinc-800 rounded-md shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <span>{editingQuestionId ? "Editing question" : "Question builder"}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Craft questions with LaTeX math formulas, options, metadata and explanations.
                    </CardDescription>
                  </div>

                  {editingQuestionId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelQuestionEdit}
                      className="h-7 text-xs rounded-md border-zinc-800"
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  {/* Statement */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400 font-medium flex items-center justify-between">
                      <span>Statement (LaTeX syntax supported: $...$ or $$...$$)</span>
                      <span className="text-zinc-500 text-[11px]">Markdown & Math</span>
                    </Label>
                    <textarea
                      required
                      rows={4}
                      placeholder="e.g. Let $A$ be a $3 \times 3$ real symmetric matrix with eigenvalues $\lambda_1, \lambda_2, \lambda_3$. Determine $\det(\exp(A))$."
                      value={manualStatement}
                      onChange={(e) => setManualStatement(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-3 text-xs text-zinc-100 rounded-md focus:outline-none focus:border-zinc-600 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Metadata Strip: Topic, Difficulty, Diagram */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-black border border-zinc-900 rounded-md">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-400 font-medium">Topic area</Label>
                      <Input
                        placeholder="Calculus, Linear Algebra..."
                        value={questionTopic}
                        onChange={(e) => setQuestionTopic(e.target.value)}
                        className="h-8 bg-zinc-950 border-zinc-800 text-xs rounded-md"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-400 font-medium">Difficulty</Label>
                      <select
                        value={questionDifficulty}
                        onChange={(e) => setQuestionDifficulty(e.target.value as typeof questionDifficulty)}
                        className="w-full h-8 bg-zinc-950 border border-zinc-800 text-xs px-2 text-zinc-200 rounded-md"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-400 font-medium">Diagram / Image</Label>
                      <div className="flex gap-1">
                        <Input
                          placeholder="Image URL or upload"
                          value={questionImageUrl}
                          onChange={(e) => setQuestionImageUrl(e.target.value)}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs rounded-md"
                        />
                        <label className="h-8 px-2 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center cursor-pointer hover:bg-zinc-800 text-zinc-400">
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
                    <Label className="text-xs text-zinc-400 font-medium">
                      Answer choices (LaTeX supported)
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span>Option A</span>
                          {correctIndex === "0" && <span className="text-emerald-400 font-medium">Correct</span>}
                        </div>
                        <Input
                          required
                          value={optA}
                          onChange={(e) => setOptA(e.target.value)}
                          placeholder="$\exp(\mathrm{tr}(A))$"
                          className="bg-black border-zinc-800 rounded-md text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span>Option B</span>
                          {correctIndex === "1" && <span className="text-emerald-400 font-medium">Correct</span>}
                        </div>
                        <Input
                          required
                          value={optB}
                          onChange={(e) => setOptB(e.target.value)}
                          placeholder="$\mathrm{tr}(\exp(A))$"
                          className="bg-black border-zinc-800 rounded-md text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span>Option C</span>
                          {correctIndex === "2" && <span className="text-emerald-400 font-medium">Correct</span>}
                        </div>
                        <Input
                          required
                          value={optC}
                          onChange={(e) => setOptC(e.target.value)}
                          placeholder="$\det(A)$"
                          className="bg-black border-zinc-800 rounded-md text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span>Option D</span>
                          {correctIndex === "3" && <span className="text-emerald-400 font-medium">Correct</span>}
                        </div>
                        <Input
                          required
                          value={optD}
                          onChange={(e) => setOptD(e.target.value)}
                          placeholder="$0$"
                          className="bg-black border-zinc-800 rounded-md text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Correct Option Selector */}
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-zinc-400 font-medium">Designated correct choice</Label>
                    <select
                      value={correctIndex}
                      onChange={(e) => setCorrectIndex(e.target.value)}
                      className="w-full h-9 bg-black border border-zinc-800 px-3 text-xs text-zinc-100 rounded-md"
                    >
                      <option value="0">Option A</option>
                      <option value="1">Option B</option>
                      <option value="2">Option C</option>
                      <option value="3">Option D</option>
                    </select>
                  </div>

                  {/* Solution */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs text-zinc-400 font-medium">
                      Official solution & KaTeX proof
                    </Label>
                    <textarea
                      rows={3}
                      placeholder="Detailed derivation shown to students upon submission..."
                      value={manualSolution}
                      onChange={(e) => setManualSolution(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-3 text-xs text-zinc-100 rounded-md focus:outline-none focus:border-zinc-600 leading-relaxed font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSavingQuestion || !selectedTestId}
                    className="w-full h-9 rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-medium text-xs"
                  >
                    {isSavingQuestion
                      ? "Saving question..."
                      : editingQuestionId
                      ? "Save question updates"
                      : "Add question to test"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right Column: Live Real-Time Math Preview Panel (5 cols) */}
            <Card className="lg:col-span-5 bg-zinc-950 border-zinc-800 rounded-md shadow-none flex flex-col justify-between">
              <div>
                <CardHeader className="border-b border-zinc-900 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Live student view preview</span>
                    </CardTitle>
                    <span className="text-[11px] text-zinc-500 font-normal">
                      KaTeX active
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Meta Pills */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-sm text-zinc-300">
                      Topic: {questionTopic || "General"}
                    </span>
                    <span
                      className={`px-2 py-0.5 border rounded-sm font-medium ${
                        questionDifficulty === "easy"
                          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                          : questionDifficulty === "hard"
                          ? "border-rose-500/30 bg-rose-950/20 text-rose-400"
                          : "border-amber-500/30 bg-amber-950/20 text-amber-400"
                      }`}
                    >
                      {questionDifficulty}
                    </span>
                  </div>

                  {/* Statement Preview */}
                  <div className="p-3.5 bg-black border border-zinc-800 rounded-md min-h-[90px] text-zinc-100 text-sm leading-relaxed space-y-2">
                    {manualStatement.trim() ? (
                      <MathRenderer content={manualStatement} />
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
                          alt="Question diagram preview"
                          className="max-h-44 max-w-full object-contain border border-zinc-800 rounded bg-zinc-950"
                        />
                      </div>
                    )}
                  </div>

                  {/* Options Preview */}
                  <div className="space-y-2">
                    <div className="text-xs text-zinc-400 font-medium">Choices preview:</div>
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
                            className={`p-2 text-xs border rounded-md flex items-start gap-2.5 ${
                              isCorrect
                                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                                : "border-zinc-800 bg-black text-zinc-300"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-semibold shrink-0 border ${
                                isCorrect
                                  ? "bg-emerald-500 text-black border-emerald-400"
                                  : "border-zinc-800 bg-zinc-900 text-zinc-400"
                              }`}
                            >
                              {char}
                            </span>
                            <div className="flex-1 overflow-x-auto text-xs">
                              {val.trim() ? (
                                <MathRenderer content={val} />
                              ) : (
                                <span className="text-zinc-600 italic text-xs">Empty option</span>
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
                      <div className="text-xs text-zinc-400 font-medium">Solution proof preview:</div>
                      <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-md text-xs text-zinc-300 leading-relaxed">
                        <MathRenderer content={manualSolution} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
            </Card>
          </div>

          {/* Existing Questions Table */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-zinc-400" />
                    <span>Existing questions in active test ({questions.length})</span>
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    All questions configured for &quot;{currentSelectedTest?.title || "Selected test"}&quot;.
                  </CardDescription>
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                  <Input
                    placeholder="Search questions by text/topic..."
                    value={questionSearchTerm}
                    onChange={(e) => setQuestionSearchTerm(e.target.value)}
                    className="pl-8 bg-black border-zinc-800 rounded-md text-xs h-8"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isQuestionsLoading ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  Loading inquiries from database...
                </div>
              ) : questions.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  No questions added to this test series yet. Use the question builder above or Excel bulk upload.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                        <th className="py-3 px-4 w-12">#</th>
                        <th className="py-3 px-4">Statement</th>
                        <th className="py-3 px-4">Topic</th>
                        <th className="py-3 px-4">Difficulty</th>
                        <th className="py-3 px-4">Correct choice</th>
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
                              <td className="py-3 px-4 text-zinc-500 font-medium tabular-nums">{idx + 1}</td>
                              <td className="py-3 px-4 text-zinc-200 max-w-md">
                                <div className="line-clamp-2">
                                  <MathRenderer content={q.statement} />
                                </div>
                              </td>
                              <td className="py-3 px-4 text-zinc-400">
                                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-sm">
                                  {q.topic || "General"}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 border rounded-sm text-[10px] font-medium ${
                                    q.difficulty === "easy"
                                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                                      : q.difficulty === "hard"
                                      ? "border-rose-500/30 bg-rose-950/20 text-rose-400"
                                      : "border-amber-500/30 bg-amber-950/20 text-amber-400"
                                  }`}
                                >
                                  {q.difficulty || "medium"}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-sm font-medium">
                                  Option {optionLabels[q.correct_option_index] || "A"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-500">
                                {q.image_url ? (
                                  <span className="text-blue-400 text-[11px] font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Yes
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditQuestionClick(q)}
                                  className="h-7 px-2 text-xs text-zinc-300 hover:text-white rounded-md"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  <span>Edit</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-md"
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
        <div id="bulk" className="space-y-6">
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
                    <span>Excel bulk question import studio</span>
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    Batch upload questions from spreadsheet with client-side syntax validation, error preview, and batch commit.
                  </CardDescription>
                </div>

                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs font-medium flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .xlsx template</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Active Test Selector for Bulk Import */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">
                  Target test series for imported questions
                </Label>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="w-full flex h-10 border border-zinc-700 bg-black px-3 py-2 text-xs rounded-md text-zinc-100"
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
              <div className="border border-dashed border-zinc-800 bg-black rounded-md p-8 text-center space-y-3">
                <Upload className="w-8 h-8 text-zinc-500 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-100">Select questions spreadsheet (.xlsx, .xls)</p>
                  <p className="text-xs text-zinc-500">
                    Columns supported: Question, Option A, Option B, Option C, Option D, Correct Answer, Solution, Topic, Difficulty, Image URL
                  </p>
                </div>

                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileSelect}
                  className="block w-full max-w-xs mx-auto text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-zinc-900 file:text-zinc-200 hover:file:bg-zinc-800 cursor-pointer"
                />
              </div>

              {/* Import Status Alert */}
              {bulkSummary && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-md text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{bulkSummary}</span>
                </div>
              )}

              {/* Validation Preview Table */}
              {bulkRows.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-zinc-100 tabular-nums">
                        Parsed: {bulkRows.length} rows
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm text-emerald-400 tabular-nums">
                        {bulkRows.filter((r) => r.isValid).length} valid
                      </span>
                      {bulkRows.some((r) => !r.isValid) && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded-sm text-red-400 tabular-nums">
                          {bulkRows.filter((r) => !r.isValid).length} errors
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleImportValidBulkRows}
                        disabled={isUploadingBulk || bulkRows.filter((r) => r.isValid).length === 0}
                        size="sm"
                        className="h-8 rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium"
                      >
                        {isUploadingBulk
                          ? "Importing questions..."
                          : `Import ${bulkRows.filter((r) => r.isValid).length} valid questions`}
                      </Button>
                    </div>
                  </div>

                  <div className="border border-zinc-800 rounded-md max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-zinc-950 z-10 border-b border-zinc-800">
                        <tr className="text-zinc-500 font-medium">
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Question statement</th>
                          <th className="py-2.5 px-3">Ans</th>
                          <th className="py-2.5 px-3">Topic</th>
                          <th className="py-2.5 px-3">Validation diagnostic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {bulkRows.map((row) => (
                          <tr
                            key={row.index}
                            className={row.isValid ? "hover:bg-zinc-900/30" : "bg-red-950/20 text-red-300"}
                          >
                            <td className="py-2 px-3 text-zinc-500 font-medium tabular-nums">{row.index}</td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="px-1.5 py-0.5 text-[10px] rounded-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Ready
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[10px] rounded-sm bg-red-500/20 text-red-400 border border-red-500/30">
                                  Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 max-w-sm truncate text-zinc-300">
                              {row.statement || <span className="text-red-400">[Missing question]</span>}
                            </td>
                            <td className="py-2 px-3 font-semibold text-zinc-100">{row.correctChar || "—"}</td>
                            <td className="py-2 px-3 text-zinc-400">{row.topic}</td>
                            <td className="py-2 px-3 text-[11px] text-zinc-400">
                              {row.isValid ? (
                                <span className="text-emerald-400">All columns validated</span>
                              ) : (
                                <span className="text-red-400 font-medium">{row.error}</span>
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
        <div id="students" className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Enrolled students
              </span>
              <span className="text-2xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {students.length}
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Lifetime submissions
              </span>
              <span className="text-2xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {allResults.length}
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-5">
              <span className="text-xs text-zinc-400 font-medium block">
                Cohort average score
              </span>
              <span className="text-2xl font-semibold text-emerald-400 mt-1 block tabular-nums">
                {analyticsStats.avg} pts
              </span>
            </Card>
          </div>

          {/* Students Table */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" />
                    <span>Student roster ({aggregatedStudents.length})</span>
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    Inspect registered student attempts, aggregate performance metrics, and individual exam scorecards.
                  </CardDescription>
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                  <Input
                    placeholder="Search by student email..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="pl-8 bg-black border-zinc-800 rounded-md text-xs h-8"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                      <th className="py-3 px-4">Student profile</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Tests taken</th>
                      <th className="py-3 px-4">Average score</th>
                      <th className="py-3 px-4">Peak score</th>
                      <th className="py-3 px-4">Last activity</th>
                      <th className="py-3 px-4 text-right">Scorecards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {aggregatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          No student profiles found matching your search.
                        </td>
                      </tr>
                    ) : (
                      aggregatedStudents.map((item) => (
                        <tr key={item.profile.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-zinc-100">
                            <div>{item.profile.full_name || item.profile.email.split("@")[0]}</div>
                            <div className="text-[11px] text-zinc-400 font-normal">{item.profile.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-medium ${
                                item.profile.role === "admin"
                                  ? "bg-purple-950/40 text-purple-400 border border-purple-700/50"
                                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                              }`}
                            >
                              {item.profile.role || "student"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-300 font-medium tabular-nums">
                            {item.totalAttempts} {item.totalAttempts === 1 ? "exam" : "exams"}
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-zinc-100 tabular-nums">
                            {item.totalAttempts > 0 ? `${item.avgScore} pts` : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-emerald-400 font-semibold tabular-nums">
                            {item.totalAttempts > 0 ? `${item.bestScore} pts` : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                            {item.lastActive !== "N/A"
                              ? new Date(item.lastActive).toLocaleDateString()
                              : "No activity"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedStudentDrilldown({ profile: item.profile, results: item.results })}
                              className="h-7 px-2.5 rounded-md border-zinc-700 bg-zinc-900 text-xs font-medium hover:bg-zinc-800"
                            >
                              View history ({item.totalAttempts})
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
      {/* TAB 5: ANALYTICS & CSV EXPORT (WITH PER-QUESTION BREAKDOWN) */}
      {/* ============================================================ */}
      {activeTab === "analytics" && (
        <div id="analytics" className="space-y-6">
          {/* Filter & Export Bar */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-medium">Scope examination:</span>
              <select
                value={analyticsTestFilter}
                onChange={(e) => setAnalyticsTestFilter(e.target.value)}
                className="bg-black border border-zinc-700 text-zinc-100 text-xs px-3 py-1.5 rounded-md min-w-[260px]"
              >
                <option value="all">All examinations (aggregate)</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleExportCSV}
              size="sm"
              className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium h-8 flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export submissions (.csv)</span>
            </Button>
          </div>

          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4">
              <span className="text-xs text-zinc-400 font-medium block">Attempts</span>
              <span className="text-xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {analyticsStats.total}
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4">
              <span className="text-xs text-zinc-400 font-medium block">Mean score</span>
              <span className="text-xl font-semibold text-emerald-400 mt-1 block tabular-nums">
                {analyticsStats.avg} pts
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4">
              <span className="text-xs text-zinc-400 font-medium block">Peak score</span>
              <span className="text-xl font-semibold text-zinc-100 mt-1 block tabular-nums">
                {analyticsStats.max} pts
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4">
              <span className="text-xs text-zinc-400 font-medium block">Lowest score</span>
              <span className="text-xl font-semibold text-zinc-400 mt-1 block tabular-nums">
                {analyticsStats.min} pts
              </span>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-md p-4 col-span-2 md:col-span-1">
              <span className="text-xs text-zinc-400 font-medium block">Cohort accuracy</span>
              <span className="text-xl font-semibold text-cyan-400 mt-1 block tabular-nums">
                {analyticsStats.accuracy}%
              </span>
            </Card>
          </div>

          {/* PER-QUESTION BREAKDOWN & DIFFICULTY (WHEN TEST SCOPED) */}
          {analyticsTestFilter !== "all" ? (
            <div className="space-y-6">
              {/* Most Missed Question Spotlight Callout */}
              {mostMissedQuestion && (
                <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-200">
                          Most missed question in this test
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-medium ${
                            mostMissedQuestion.difficultyIndicator === "hard"
                              ? "bg-rose-950/30 text-rose-400 border border-rose-500/30"
                              : mostMissedQuestion.difficultyIndicator === "medium"
                              ? "bg-amber-950/30 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-950/30 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {mostMissedQuestion.difficultyIndicator === "hard" ? "High difficulty" : mostMissedQuestion.difficultyIndicator === "medium" ? "Moderate difficulty" : "Low difficulty"}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-100 max-w-3xl leading-relaxed">
                        <MathRenderer content={mostMissedQuestion.question.statement} />
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 bg-black/50 p-3 rounded-md border border-zinc-900 min-w-[140px]">
                      <div className="text-xl font-semibold text-rose-400 tabular-nums">
                        {mostMissedQuestion.missRate}%
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Miss rate ({mostMissedQuestion.missCount} / {mostMissedQuestion.totalSubmissions} attempts)
                      </div>
                      <div className="text-[11px] text-emerald-400 mt-1 tabular-nums">
                        {mostMissedQuestion.accuracyRate}% accuracy
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Per-Question Detailed Table */}
              <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
                <CardHeader className="border-b border-zinc-900 pb-3">
                  <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-zinc-400" />
                    <span>Per-question breakdown ({questionAnalyticsList.length} inquiries)</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Ranked by highest miss rate to highlight questions requiring cohort review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isAnalyticsQuestionsLoading ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      Loading question analytics...
                    </div>
                  ) : questionAnalyticsList.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      No questions found for this test.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                            <th className="py-2.5 px-4 w-12">Rank</th>
                            <th className="py-2.5 px-4">Statement snippet</th>
                            <th className="py-2.5 px-4">Topic</th>
                            <th className="py-2.5 px-4">Difficulty</th>
                            <th className="py-2.5 px-4">Miss rate</th>
                            <th className="py-2.5 px-4">Accuracy</th>
                            <th className="py-2.5 px-4 text-right">Correct answer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {questionAnalyticsList.map((qa, idx) => {
                            const optionLabels = ["A", "B", "C", "D"];
                            return (
                              <tr key={qa.question.id} className="hover:bg-zinc-900/40 transition-colors">
                                <td className="py-3 px-4 text-zinc-500 font-medium tabular-nums">
                                  #{idx + 1}
                                </td>
                                <td className="py-3 px-4 text-zinc-200 max-w-sm">
                                  <div className="line-clamp-2">
                                    <MathRenderer content={qa.question.statement} />
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-zinc-400">
                                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-sm">
                                    {qa.question.topic || "General"}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 border rounded-sm text-[10px] font-medium ${
                                      qa.difficultyIndicator === "hard"
                                        ? "border-rose-500/30 bg-rose-950/20 text-rose-400"
                                        : qa.difficultyIndicator === "medium"
                                        ? "border-amber-500/30 bg-amber-950/20 text-amber-400"
                                        : "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                                    }`}
                                  >
                                    {qa.difficultyIndicator}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 bg-zinc-900 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${
                                          qa.missRate >= 60
                                            ? "bg-rose-500"
                                            : qa.missRate >= 35
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                        }`}
                                        style={{ width: `${qa.missRate}%` }}
                                      />
                                    </div>
                                    <span className="tabular-nums font-medium text-zinc-200">
                                      {qa.missRate}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-zinc-300 tabular-nums">
                                  {qa.accuracyRate}%
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-sm text-zinc-300 font-medium">
                                    Option {optionLabels[qa.question.correct_option_index] || "A"}
                                  </span>
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
          ) : (
            /* Per-Test Breakdown Table when all examinations selected */
            <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
              <CardHeader className="border-b border-zinc-900 pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-zinc-100">
                    Per-test breakdown ({tests.length} tests)
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Aggregated scores, attempts, and completion metrics across examinations.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                        <th className="py-2.5 px-4">Test title</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Questions</th>
                        <th className="py-2.5 px-4">Attempts</th>
                        <th className="py-2.5 px-4">Average score</th>
                        <th className="py-2.5 px-4">Peak score</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {tests.map((t) => {
                        const testSubs = allResults.filter((r) => r.test_id === t.id);
                        const testScores = testSubs.map((r) => r.score);
                        const testAvg =
                          testSubs.length > 0
                            ? Math.round(testScores.reduce((a, b) => a + b, 0) / testSubs.length)
                            : 0;
                        const testMax = testScores.length > 0 ? Math.max(...testScores) : 0;
                        const isPub = t.is_published !== false;

                        return (
                          <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3 px-4 font-medium text-zinc-100 max-w-xs truncate">
                              {t.title}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                                  isPub
                                    ? "bg-emerald-950/30 text-emerald-400 border border-emerald-500/20"
                                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                                }`}
                              >
                                {isPub ? "Live" : "Draft"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400 tabular-nums">
                              {t.questions?.length ?? 0}
                            </td>
                            <td className="py-3 px-4 text-zinc-300 font-medium tabular-nums">
                              {testSubs.length}
                            </td>
                            <td className="py-3 px-4 text-emerald-400 font-medium tabular-nums">
                              {testSubs.length > 0 ? `${testAvg} pts` : "—"}
                            </td>
                            <td className="py-3 px-4 text-zinc-300 tabular-nums">
                              {testSubs.length > 0 ? `${testMax} pts` : "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAnalyticsTestFilter(t.id)}
                                className="h-6 px-2 text-xs rounded-md border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                              >
                                Question miss rates
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visual Score Distribution Histogram */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-300">
                Cohort score distribution histogram
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Frequency of submissions segmented into quartile score brackets.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-4 h-40 items-end p-4 bg-black border border-zinc-900 rounded-md">
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
                      <span className="text-xs font-medium text-zinc-200 tabular-nums">{bar.count}</span>
                      <div
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                        className={`w-full rounded-t transition-all duration-300 ${
                          idx === 3
                            ? "bg-emerald-500"
                            : idx === 2
                            ? "bg-cyan-500"
                            : idx === 1
                            ? "bg-amber-500"
                            : "bg-zinc-700"
                        }`}
                      />
                      <span className="text-[10px] text-zinc-500">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Live Submissions Feed */}
          <Card className="bg-zinc-950 border-zinc-800 rounded-md shadow-none">
            <CardHeader className="border-b border-zinc-900 pb-4">
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Live submissions log ({filteredResults.length})
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Chronological submission stream with instant scorecard inspector.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 bg-zinc-950 font-medium">
                      <th className="py-2.5 px-4">Test title</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Score</th>
                      <th className="py-2.5 px-4">Attempted</th>
                      <th className="py-2.5 px-4">Correct</th>
                      <th className="py-2.5 px-4">Submitted at</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-500">
                          No student test submissions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item) => {
                        const studentEmail = studentMap.get(item.student_id) || item.student_id.slice(0, 8);
                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3 px-4 font-medium text-zinc-100">
                              {item.tests?.title || "Unknown test"}
                            </td>
                            <td className="py-3 px-4 text-zinc-400 text-xs max-w-xs truncate" title={studentEmail}>
                              {studentEmail}
                            </td>
                            <td className="py-3 px-4 font-semibold text-emerald-400 tabular-nums">{item.score} pts</td>
                            <td className="py-3 px-4 text-zinc-300 tabular-nums">{item.total_attempted}</td>
                            <td className="py-3 px-4 text-emerald-400 tabular-nums">{item.total_correct}</td>
                            <td className="py-3 px-4 text-zinc-500 text-[11px]">
                              {new Date(item.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => router.push(`/results?resultId=${item.id}`)}
                                className="h-7 px-2.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-medium hover:bg-zinc-800 text-zinc-200"
                              >
                                Inspect
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
      {/* MODAL: EDIT TEST SERIES */}
      {/* ============================================================ */}
      {editingTest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg p-6 space-y-5 rounded-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                Edit test settings
              </h3>
              <button
                onClick={() => setEditingTest(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTest} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 font-medium">Test title</Label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-black border-zinc-800 rounded-md text-zinc-100 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Duration (m)</Label>
                  <Input
                    type="number"
                    required
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="bg-black border-zinc-800 rounded-md text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Correct (+)</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={editPositiveMarks}
                    onChange={(e) => setEditPositiveMarks(e.target.value)}
                    className="bg-black border-zinc-800 rounded-md text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Wrong (-)</Label>
                  <Input
                    type="number"
                    step="any"
                    required
                    value={editNegativeMarks}
                    onChange={(e) => setEditNegativeMarks(e.target.value)}
                    className="bg-black border-zinc-800 rounded-md text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Window start</Label>
                  <Input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="bg-black border-zinc-800 rounded-md text-xs text-zinc-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-medium">Window end</Label>
                  <Input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="bg-black border-zinc-800 rounded-md text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsPublished}
                    onChange={(e) => setEditIsPublished(e.target.checked)}
                    className="rounded border-zinc-700 bg-black text-white focus:ring-0"
                  />
                  <span>Published (visible to students)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTest(null)}
                  className="rounded-md border-zinc-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-medium text-xs"
                >
                  Save changes
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
          <div className="bg-zinc-950 border border-red-900/50 w-full max-w-md p-6 space-y-4 rounded-md shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Confirm test deletion
              </h3>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="text-zinc-100 font-semibold">&quot;{deletingTest.title}&quot;</span>? All associated
              questions within this test series will be deleted. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-900">
              <Button
                variant="outline"
                onClick={() => setDeletingTest(null)}
                className="rounded-md border-zinc-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteTest}
                className="rounded-md bg-red-600 hover:bg-red-700 text-white font-medium text-xs"
              >
                Delete test
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
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Student scorecards & history
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedStudentDrilldown.profile.email} (ID: {selectedStudentDrilldown.profile.id.slice(0, 8)}...)
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentDrilldown(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {selectedStudentDrilldown.results.length === 0 ? (
                <p className="text-center py-8 text-zinc-500 text-xs">
                  This student has not submitted any exam attempts yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedStudentDrilldown.results.map((res) => (
                    <div
                      key={res.id}
                      className="p-3.5 bg-black border border-zinc-900 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-zinc-100">
                          {res.tests?.title || "Test series"}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span>Score: <strong className="text-zinc-100 tabular-nums">{res.score} pts</strong></span>
                          <span>Attempted: <span className="tabular-nums">{res.total_attempted}</span></span>
                          <span>Correct: <strong className="text-emerald-400 tabular-nums">{res.total_correct}</strong></span>
                          <span className="text-zinc-500">
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
                        className="h-7 px-2.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-medium hover:bg-zinc-800 text-zinc-200 shrink-0 flex items-center gap-1"
                      >
                        <span>Review exam</span>
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
                className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-zinc-200 text-xs font-medium"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}