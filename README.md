# Mathlete Pro Gym — Advanced Mathematics Examination Platform

Mathlete Pro Gym is a high-reliability, production-grade Computer-Based Testing (CBT) platform engineered specifically for advanced mathematics examinations. It features distraction-free proctoring, synchronized timers, single-engine KaTeX LaTeX rendering, and server-side atomic evaluation.

---

## 1. What the Platform Is

Mathlete Pro Gym provides a distraction-free, reliable environment for administering competitive and olympiad mathematics tests.

The platform is strictly bounded into two distinct user personas:
- **Teacher (Faculty / Admin)**:
  - Test creation studio with duration, total marks, positive/negative marking (+4/-1, etc.), and proctoring strike tolerances.
  - Question authoring studio with live KaTeX preview (supporting both inline math `$x^2$` and display math `$$\int f(x) dx$$`).
  - Excel bulk question uploader (`.xlsx`, `.xls`) with automated schema validation.
  - Test publishing toggle (draft vs. published).
  - Student directory, individual student performance scorecards, and cohort test analytics with per-question miss rates.
- **Student**:
  - Live discovery dashboard of published examinations.
  - Proctored exam interface with persistent local answer caching, question navigation palette (answered, marked for review, unvisited), fullscreen detection, and multi-tab strike enforcement.
  - Immediate scorecard generation upon submission with question-by-question breakdown and step-by-step mathematical solutions.
  - Historical exam records and performance tracking.

---

## 2. Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **Package Manager**: `npm` (comes with Node.js)
- **Supabase Account**: A free or paid Supabase project with PostgreSQL, Auth, and Row Level Security (RLS) enabled.

---

## 3. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Populate the values from your Supabase Dashboard (**Project Settings &rarr; API**):

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client anon key for browser authentication |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Standard publishable key (same as anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` *(Optional)* | Backend service role secret (never exposed to client) |

---

## 4. Step-by-Step Setup

### Step 4.1: Clone & Install Dependencies
```bash
git clone <repository-url>
cd mathletepro-tests
npm install
```

### Step 4.2: Apply Supabase Migrations
Open the **SQL Editor** in your Supabase Dashboard and execute the consolidated production migration:

1. Open `supabase/complete_schema.sql`.
2. Copy the entire file content and paste it into the Supabase SQL Editor.
3. Click **Run**.

This script is fully idempotent and safely configures:
- All required tables: `profiles`, `tests`, `questions`, `test_attempts`, `student_answers`.
- Row Level Security (RLS) policies with recursive-safe `is_admin()` checks.
- Sanitized `student_questions` view (hides correct answers and solutions from student queries).
- Atomic grading and exam initiation RPC functions (`start_exam_session`, `submit_and_grade_exam`).
- Triggers for user registration and role tampering prevention.

### Step 4.3: Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Role Assignment Guide (Teacher / Admin Promotion)

By default, every account created through the platform registration page is automatically assigned the `student` role. Self-promotion or role manipulation from the client is blocked at the database level.

To designate a faculty member or administrator:

1. Have the teacher sign up via the `/auth/sign-up` screen using their email address.
2. In your Supabase Dashboard, go to **SQL Editor** and execute:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'teacher@school.edu';
```

3. When the teacher signs in or refreshes, the platform automatically routes them to `/admin`.

---

## 6. Architecture & Security Model

### Route Groups & Server Guards
- `(admin)/admin/*`: Faculty modules protected by `requireAdmin()` in `lib/auth/guards.ts`.
- `(student)/student/*`: Student modules protected by `requireUser()` in `lib/auth/guards.ts`.
- `/dashboard`: Role router redirecting admins to `/admin` and students to `/student/tests`.
- `/`: Smart landing page: authenticated users are routed to their respective dashboards; unauthenticated users see the minimal, dark-mode sign-in gateway.

### Single Math Rendering Engine
All mathematical equations are rendered via `components/MathRenderer.tsx` using `katex` directly. Unused third-party wrappers (`react-latex-next`, `react-katex`) are completely purged to maintain a lean bundle and zero rendering discrepancies.

### Proctoring & Atomic Evaluation
- Strike tracking: Visibility changes and blur events trigger warning alerts and increment strikes via `/api/exam/strike`. Exceeding maximum strikes forces immediate submission.
- Atomic grading: Submissions are graded securely on the server via PostgreSQL RPC (`submit_and_grade_exam`), ensuring correct answers are never revealed prematurely or modified on the client.

---

## 7. Design System & Typography Rules

The interface strictly adheres to clean, dark-mode, distraction-free principles:
- **Typeface**: `Inter` loaded via `next/font/google` (`display: swap`).
- **Allowed Weights Only**:
  - `400` (normal): Body text, descriptions, table cells.
  - `500` (medium): Buttons, tabs, inputs, nav links, table headers, labels.
  - `600` (semibold): Page titles, modal titles, card headers, key score figures.
  - Never use bold (`font-bold` / 700), extra-bold (800), or black (900).
- **Transform**: Sentence case throughout. No all-caps (`uppercase`) or `tracking-widest` on buttons, nav, headings, or cards.
- **Monospace Usage**: Monospace (`font-mono` / `tabular-nums`) is strictly reserved for the examination countdown timer and tabular numeric figures.

---

## 8. Verification & Quality Gates

Run the verification suite locally:

```bash
# 1. Type safety check
npx tsc --noEmit

# 2. Code linting
npm run lint

# 3. Production build
npm run build
```

---

## 9. Production Deployment Guide (Vercel + Supabase)

### Deploying to Vercel
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Go to [Vercel](https://vercel.com) and import the repository.
3. In **Settings &rarr; Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<your-project>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `<your-anon-key>`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: `<your-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY` *(Optional)*: `<your-service-role-key>`
4. Click **Deploy**. Vercel will compile Next.js with Turbopack and deploy to the global edge network.
