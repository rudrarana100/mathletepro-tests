export interface DemoTest {
  id: string;
  title: string;
  duration_minutes: number;
  positive_marks: number;
  negative_marks: number;
  is_published: boolean;
  start_time: string | null;
  end_time: string | null;
  questions?: Array<{ id: string }>;
}

export interface DemoQuestion {
  id: string;
  test_id: string;
  statement: string;
  options: string[];
  correct_option_index: number;
  solution: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  image_url?: string | null;
}

export interface DemoResult {
  id: string;
  test_id: string;
  student_id: string;
  score: number;
  total_attempted: number;
  total_correct: number;
  answers: Record<string, number>;
  created_at: string;
  tests?: { title: string; duration_minutes?: number };
}

export const DEMO_TESTS: DemoTest[] = [
  {
    id: "test-jee-advanced-01",
    title: "JEE Advanced 2026: Pure Mathematics Mock I",
    duration_minutes: 60,
    positive_marks: 4,
    negative_marks: 1,
    is_published: true,
    start_time: null,
    end_time: null,
    questions: [
      { id: "q-jee-1" },
      { id: "q-jee-2" },
      { id: "q-jee-3" },
      { id: "q-jee-4" },
      { id: "q-jee-5" },
    ],
  },
  {
    id: "test-olympiad-stage-2",
    title: "National Olympiad Stage II: Algebra & Number Theory",
    duration_minutes: 75,
    positive_marks: 4,
    negative_marks: 1,
    is_published: true,
    start_time: null,
    end_time: null,
    questions: [
      { id: "q-oly-1" },
      { id: "q-oly-2" },
      { id: "q-oly-3" },
      { id: "q-oly-4" },
    ],
  },
  {
    id: "test-calculus-drill-03",
    title: "Integral Calculus & Differential Equations Speed Drill",
    duration_minutes: 45,
    positive_marks: 3,
    negative_marks: 1,
    is_published: true,
    start_time: null,
    end_time: null,
    questions: [
      { id: "q-calc-1" },
      { id: "q-calc-2" },
      { id: "q-calc-3" },
    ],
  },
];

export const DEMO_QUESTIONS: Record<string, DemoQuestion[]> = {
  "test-jee-advanced-01": [
    {
      id: "q-jee-1",
      test_id: "test-jee-advanced-01",
      statement: "Evaluate the definite integral: \\[ I = \\int_{0}^{\\frac{\\pi}{2}} \\frac{\\sin^3 x}{\\sin^3 x + \\cos^3 x} \\, dx \\]",
      options: [
        "$\\frac{\\pi}{4}$",
        "$\\frac{\\pi}{2}$",
        "$\\frac{\\pi}{8}$",
        "$1$"
      ],
      correct_option_index: 0,
      solution: "Using King's property $\\int_{a}^{b} f(x)\\,dx = \\int_{a}^{b} f(a+b-x)\\,dx$, substituting $x \\to \\frac{\\pi}{2} - x$ yields:\n\\[ I = \\int_{0}^{\\frac{\\pi}{2}} \\frac{\\cos^3 x}{\\cos^3 x + \\sin^3 x} \\, dx \\]\nAdding the two expressions:\n\\[ 2I = \\int_{0}^{\\frac{\\pi}{2}} 1 \\, dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4} \\]",
      topic: "Definite Integrals",
      difficulty: "medium",
    },
    {
      id: "q-jee-2",
      test_id: "test-jee-advanced-01",
      statement: "Compute the limit: \\[ L = \\lim_{x \\to 0} \\frac{e^{x^2} - 1 - x^2}{x^4} \\]",
      options: [
        "$\\frac{1}{2}$",
        "$\\frac{1}{4}$",
        "$0$",
        "Does not exist"
      ],
      correct_option_index: 0,
      solution: "Using the Taylor expansion $e^u = 1 + u + \\frac{u^2}{2!} + \\mathcal{O}(u^3)$ for $u = x^2$:\n\\[ e^{x^2} = 1 + x^2 + \\frac{x^4}{2} + \\mathcal{O}(x^6) \\]\nThus, $\\frac{e^{x^2} - 1 - x^2}{x^4} = \\frac{1}{2} + \\mathcal{O}(x^2) \\to \\frac{1}{2}$ as $x \\to 0$.",
      topic: "Calculus & Limits",
      difficulty: "easy",
    },
    {
      id: "q-jee-3",
      test_id: "test-jee-advanced-01",
      statement: "Let $A$ be a $3 \\times 3$ invertible matrix such that $\\det(A) = 3$. Find the value of $\\det(2 \\cdot \\operatorname{adj}(A))$.",
      options: [
        "$72$",
        "$216$",
        "$24$",
        "$144$"
      ],
      correct_option_index: 0,
      solution: "For an $n \\times n$ matrix $A$, $\\det(k A) = k^n \\det(A)$ and $\\det(\\operatorname{adj}(A)) = (\\det A)^{n-1}$.\nHere $n = 3$, so:\n\\[ \\det(2 \\operatorname{adj}(A)) = 2^3 \\cdot \\det(\\operatorname{adj}(A)) = 8 \\cdot (\\det A)^{3-1} = 8 \\cdot 3^2 = 72 \\]",
      topic: "Linear Algebra & Matrices",
      difficulty: "medium",
    },
    {
      id: "q-jee-4",
      test_id: "test-jee-advanced-01",
      statement: "If the roots of the quadratic equation $x^2 - 6x + c = 0$ are $\\alpha$ and $\\beta$, such that $\\alpha^2 + \\beta^2 = 26$, determine the constant $c$.",
      options: [
        "$5$",
        "$-5$",
        "$10$",
        "$8$"
      ],
      correct_option_index: 0,
      solution: "By Vieta's formulas, $\\alpha + \\beta = 6$ and $\\alpha\\beta = c$.\nUsing $\\alpha^2 + \\beta^2 = (\\alpha+\\beta)^2 - 2\\alpha\\beta$:\n\\[ 26 = 6^2 - 2c \\implies 2c = 36 - 26 = 10 \\implies c = 5 \\]",
      topic: "Quadratic Equations",
      difficulty: "easy",
    },
    {
      id: "q-jee-5",
      test_id: "test-jee-advanced-01",
      statement: "Find the unit vector perpendicular to both vectors $\\vec{u} = \\hat{i} + \\hat{j}$ and $\\vec{v} = \\hat{j} + \\hat{k}$.",
      options: [
        "$\\frac{1}{\\sqrt{3}}(\\hat{i} - \\hat{j} + \\hat{k})$",
        "$\\frac{1}{\\sqrt{2}}(\\hat{i} - \\hat{k})$",
        "$\\frac{1}{\\sqrt{3}}(\\hat{i} + \\hat{j} + \\hat{k})$",
        "$\\frac{1}{2}(\\hat{i} - \\hat{j})$"
      ],
      correct_option_index: 0,
      solution: "Compute the cross product:\n\\[ \\vec{u} \\times \\vec{v} = \\begin{vmatrix} \\hat{i} & \\hat{j} & \\hat{k} \\\\ 1 & 1 & 0 \\\\ 0 & 1 & 1 \\end{vmatrix} = \\hat{i}(1) - \\hat{j}(1) + \\hat{k}(1) = \\hat{i} - \\hat{j} + \\hat{k} \\]\nNormalizing: $|\\vec{u} \\times \\vec{v}| = \\sqrt{1^2 + (-1)^2 + 1^2} = \\sqrt{3}$.\nUnit vector is $\\frac{1}{\\sqrt{3}}(\\hat{i} - \\hat{j} + \\hat{k})$.",
      topic: "Vector Algebra",
      difficulty: "medium",
    },
  ],
  "test-olympiad-stage-2": [
    {
      id: "q-oly-1",
      test_id: "test-olympiad-stage-2",
      statement: "Find the remainder when $2^{2026}$ is divided by $7$.",
      options: [
        "$2$",
        "$4$",
        "$1$",
        "$6$"
      ],
      correct_option_index: 0,
      solution: "Notice that $2^3 = 8 \\equiv 1 \\pmod{7}$.\nWrite $2026 = 3 \\times 675 + 1$.\nThen:\n\\[ 2^{2026} = (2^3)^{675} \\cdot 2^1 \\equiv 1^{675} \\cdot 2 \\equiv 2 \\pmod{7} \\]",
      topic: "Modular Arithmetic & Number Theory",
      difficulty: "medium",
    },
    {
      id: "q-oly-2",
      test_id: "test-olympiad-stage-2",
      statement: "Let $x, y, z > 0$ such that $xyz = 1$. What is the minimum possible value of $(x+1)(y+1)(z+1)$?",
      options: [
        "$8$",
        "$6$",
        "$4$",
        "$9$"
      ],
      correct_option_index: 0,
      solution: "By AM-GM inequality, $x + 1 \\ge 2\\sqrt{x}$, $y + 1 \\ge 2\\sqrt{y}$, and $z + 1 \\ge 2\\sqrt{z}$.\nMultiplying these:\n\\[ (x+1)(y+1)(z+1) \\ge 8\\sqrt{xyz} = 8 \\]\nEquality holds when $x = y = z = 1$.",
      topic: "Inequalities",
      difficulty: "medium",
    },
    {
      id: "q-oly-3",
      test_id: "test-olympiad-stage-2",
      statement: "How many positive integer divisors does the number $N = 720$ have?",
      options: [
        "$30$",
        "$24$",
        "$36$",
        "$18$"
      ],
      correct_option_index: 0,
      solution: "Prime factorization: $720 = 2^4 \\times 3^2 \\times 5^1$.\nThe total number of divisors is:\n\\[ d(N) = (4 + 1)(2 + 1)(1 + 1) = 5 \\times 3 \\times 2 = 30 \\]",
      topic: "Combinatorics & Number Theory",
      difficulty: "easy",
    },
    {
      id: "q-oly-4",
      test_id: "test-olympiad-stage-2",
      statement: "Determine the number of real solutions to the equation: \\[ 2^x + 3^x = 5^x \\]",
      options: [
        "$1$",
        "$0$",
        "$2$",
        "Infinitely many"
      ],
      correct_option_index: 0,
      solution: "Divide through by $5^x$ to obtain $f(x) = \\left(\\frac{2}{5}\\right)^x + \\left(\\frac{3}{5}\\right)^x = 1$.\nSince both $\\frac{2}{5} < 1$ and $\\frac{3}{5} < 1$, the function $f(x)$ is strictly decreasing on $\\mathbb{R}$.\nAt $x = 1$, $f(1) = \\frac{2}{5} + \\frac{3}{5} = 1$.\nBecause $f$ is strictly monotonic, $x = 1$ is the unique real solution.",
      topic: "Real Analysis & Functions",
      difficulty: "medium",
    },
  ],
  "test-calculus-drill-03": [
    {
      id: "q-calc-1",
      test_id: "test-calculus-drill-03",
      statement: "Find the general solution of the first-order differential equation: \\[ \\frac{dy}{dx} + 2y = e^{-x} \\]",
      options: [
        "$y = e^{-x} + C e^{-2x}$",
        "$y = e^{-2x} + C e^{-x}$",
        "$y = -e^{-x} + C e^{2x}$",
        "$y = x e^{-x} + C$"
      ],
      correct_option_index: 0,
      solution: "The integrating factor is $I(x) = e^{\\int 2 dx} = e^{2x}$.\nMultiplying both sides:\n\\[ \\frac{d}{dx}[y e^{2x}] = e^{-x} e^{2x} = e^x \\]\nIntegrating both sides:\n\\[ y e^{2x} = e^x + C \\implies y = e^{-x} + C e^{-2x} \\]",
      topic: "Differential Equations",
      difficulty: "medium",
    },
    {
      id: "q-calc-2",
      test_id: "test-calculus-drill-03",
      statement: "Evaluate the improper integral: \\[ \\int_{0}^{\\infty} x e^{-2x} \\, dx \\]",
      options: [
        "$\\frac{1}{4}$",
        "$\\frac{1}{2}$",
        "$1$",
        "$\\frac{1}{8}$"
      ],
      correct_option_index: 0,
      solution: "Using the Gamma function formula $\\int_0^\\infty x^n e^{-ax}\\,dx = \\frac{n!}{a^{n+1}}$ with $n=1$ and $a=2$:\n\\[ \\int_{0}^{\\infty} x e^{-2x} \\, dx = \\frac{1!}{2^2} = \\frac{1}{4} \\]",
      topic: "Improper Integrals",
      difficulty: "easy",
    },
    {
      id: "q-calc-3",
      test_id: "test-calculus-drill-03",
      statement: "Find the curvature $\\kappa$ of the circle $x^2 + y^2 = 16$ at any point on its circumference.",
      options: [
        "$\\frac{1}{4}$",
        "$4$",
        "$\\frac{1}{16}$",
        "$16$"
      ],
      correct_option_index: 0,
      solution: "The radius of the circle is $R = \\sqrt{16} = 4$.\nThe curvature of any circle of radius $R$ is constant and equals $\\kappa = \\frac{1}{R} = \\frac{1}{4}$.",
      topic: "Differential Geometry",
      difficulty: "easy",
    },
  ],
};

export const DEMO_PAST_RESULTS: DemoResult[] = [
  {
    id: "demo-result-001",
    test_id: "test-jee-advanced-01",
    student_id: "demo-student-id",
    score: 16,
    total_attempted: 5,
    total_correct: 4,
    answers: {
      "q-jee-1": 0,
      "q-jee-2": 0,
      "q-jee-3": 0,
      "q-jee-4": 0,
      "q-jee-5": 1, // wrong
    },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    tests: {
      title: "JEE Advanced 2026: Pure Mathematics Mock I",
      duration_minutes: 60,
    },
  },
  {
    id: "demo-result-002",
    test_id: "test-olympiad-stage-2",
    student_id: "demo-student-id",
    score: 12,
    total_attempted: 4,
    total_correct: 3,
    answers: {
      "q-oly-1": 0,
      "q-oly-2": 0,
      "q-oly-3": 0,
      "q-oly-4": 2, // wrong
    },
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    tests: {
      title: "National Olympiad Stage II: Algebra & Number Theory",
      duration_minutes: 75,
    },
  },
];
