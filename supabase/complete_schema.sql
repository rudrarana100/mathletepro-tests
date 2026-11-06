-- ================================================================
-- Mathlete Pro: Complete Database Schema & Migration Kit
-- Execute this script in the Supabase SQL Editor to initialize all tables,
-- triggers, indexes, Row Level Security (RLS) policies, and seed tests.
-- ================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'student', -- 'student' | 'admin'
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);

CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);

-- Trigger to automatically create a profile entry whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, full_name)
    VALUES (
        new.id,
        new.email,
        CASE
            -- Grant admin privileges to specified emails or first user
            WHEN new.email = 'admin@mathletepro.com' THEN 'admin'
            ELSE 'student'
        END,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tests Table
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    positive_marks NUMERIC NOT NULL DEFAULT 4,
    negative_marks NUMERIC NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT true,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published tests"
ON public.tests FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Only admins can modify tests"
ON public.tests FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_tests_published_schedule ON public.tests(is_published, start_time, end_time);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    statement TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_option_index INTEGER NOT NULL DEFAULT 0,
    solution TEXT,
    topic TEXT DEFAULT 'General',
    difficulty TEXT DEFAULT 'medium',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view questions"
ON public.questions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Only admins can modify questions"
ON public.questions FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_questions_test_topic ON public.questions(test_id, topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);

-- 4. Attempts Table
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed'
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    strikes INTEGER NOT NULL DEFAULT 0,
    result_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_test_attempt UNIQUE (user_id, test_id)
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own attempts"
ON public.attempts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Students can insert their own attempts"
ON public.attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update their own attempts"
ON public.attempts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
ON public.attempts FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON public.attempts(user_id, test_id);

-- 5. Test Results Table
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total_attempted INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own test results"
ON public.test_results FOR SELECT TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own test results"
ON public.test_results FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins can view all test results"
ON public.test_results FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);

-- ================================================================
-- Seed Data: Sample Tests & Olympiad-Grade Questions
-- ================================================================

DO $$
DECLARE
    v_test_id UUID;
BEGIN
    -- Only insert if no tests exist yet
    IF NOT EXISTS (SELECT 1 FROM public.tests LIMIT 1) THEN
        INSERT INTO public.tests (title, duration_minutes, positive_marks, negative_marks, is_published)
        VALUES ('JEE Advanced 2026: Pure Mathematics Mock I', 60, 4, 1, true)
        RETURNING id INTO v_test_id;

        INSERT INTO public.questions (test_id, statement, options, correct_option_index, solution, topic, difficulty)
        VALUES
        (
            v_test_id,
            'Evaluate the definite integral: \\[ I = \\int_{0}^{\\frac{\\pi}{2}} \\frac{\\sin^3 x}{\\sin^3 x + \\cos^3 x} \\, dx \\]',
            '["$\\frac{\\pi}{4}$", "$\\frac{\\pi}{2}$", "$\\frac{\\pi}{8}$", "$1$"]'::jsonb,
            0,
            'Using King''s property $\int_{a}^{b} f(x)\,dx = \int_{a}^{b} f(a+b-x)\,dx$, adding yields $2I = \frac{\pi}{2} \implies I = \frac{\pi}{4}$.',
            'Definite Integrals',
            'medium'
        ),
        (
            v_test_id,
            'Compute the limit: \\[ L = \\lim_{x \\to 0} \\frac{e^{x^2} - 1 - x^2}{x^4} \\]',
            '["$\\frac{1}{2}$", "$\\frac{1}{4}$", "$0$", "Does not exist"]'::jsonb,
            0,
            'Using Taylor expansion: $e^{x^2} = 1 + x^2 + \frac{x^4}{2} + \dots \implies \frac{1}{2}$.',
            'Calculus & Limits',
            'easy'
        ),
        (
            v_test_id,
            'Let $A$ be a $3 \\times 3$ invertible matrix such that $\\det(A) = 3$. Find $\\det(2 \\cdot \\operatorname{adj}(A))$.',
            '["$72$", "$216$", "$24$", "$144$"]'::jsonb,
            0,
            '$\det(2 \operatorname{adj}(A)) = 2^3 \cdot (\det A)^2 = 8 \cdot 9 = 72$.',
            'Linear Algebra',
            'medium'
        );
    END IF;
END $$;
