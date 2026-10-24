-- ================================================================
-- Table: test_results
-- Description: Stores student test submission scores and answers
-- ================================================================

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

-- Index for fast student and test lookups
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- RLS Policy: Students can view their own test results
-- ----------------------------------------------------------------
CREATE POLICY "Students can view their own test results"
ON public.test_results
FOR SELECT
TO authenticated
USING (
    auth.uid() = student_id
);

-- ----------------------------------------------------------------
-- RLS Policy: Students can insert their own test results
-- ----------------------------------------------------------------
CREATE POLICY "Students can insert their own test results"
ON public.test_results
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = student_id
);

-- ----------------------------------------------------------------
-- RLS Policy: Admins can view all test results
-- ----------------------------------------------------------------
CREATE POLICY "Admins can view all test results"
ON public.test_results
FOR SELECT
TO authenticated
USING (
    (auth.jwt() ->> 'email') = 'test@gmail.com'
);
