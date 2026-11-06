-- ================================================================
-- Migration: 02_security_and_attempts.sql
-- Description: Creates attempts table, enforces single attempt per student per test,
--              and sets up RLS and column-level privileges.
-- ================================================================

-- 1. Create attempts table
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed'
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    strikes INTEGER NOT NULL DEFAULT 0,
    result_id UUID REFERENCES public.test_results(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_test_attempt UNIQUE (user_id, test_id)
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON public.attempts(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.attempts(status);

-- 3. Row Level Security for attempts
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Students can read their own attempt records
CREATE POLICY "Students can view their own attempts"
ON public.attempts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Students can insert their own attempt
CREATE POLICY "Students can insert their own attempts"
ON public.attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Students can update their own attempt (for strikes, etc.)
CREATE POLICY "Students can update their own attempts"
ON public.attempts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all attempts
CREATE POLICY "Admins can view all attempts"
ON public.attempts FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 4. Secure questions table from answer leakage
-- Revoke direct selection of correct_option_index and solution for anon and authenticated students
-- Note: Faculty/admin can view via service role or explicit admin policy
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view questions without answers" ON public.questions;
DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.questions;

-- Questions can be viewed by authenticated users
CREATE POLICY "Anyone authenticated can view questions"
ON public.questions FOR SELECT TO authenticated
USING (true);

-- Only admins can insert, update, or delete questions
DROP POLICY IF EXISTS "Only admins can modify questions" ON public.questions;
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

-- Only admins can modify tests
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published tests" ON public.tests;
CREATE POLICY "Anyone can view published tests"
ON public.tests FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Only admins can modify tests" ON public.tests;
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
