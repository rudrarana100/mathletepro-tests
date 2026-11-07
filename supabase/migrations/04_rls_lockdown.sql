-- ================================================================
-- Migration: 04_rls_lockdown.sql
-- Description: Establishes recursive-safe is_admin() helper, locks down RLS
--              across profiles, tests, questions, attempts, and test_results,
--              creates the safe student_questions view (zero answer leakage),
--              and provides the atomic server-side grade_and_submit_exam RPC.
--              Includes explicit ALTER TABLE ADD COLUMN IF NOT EXISTS clauses
--              to safely upgrade pre-existing tables.
-- ================================================================

-- 1. Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Profiles Table Lockdown
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student',
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile, admins can read all" ON public.profiles;

CREATE POLICY "Users can read own profile, admins can read all"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON public.profiles;

CREATE POLICY "Users can update own profile, admins can update any"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Role escalation protection trigger
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS trigger AS $$
BEGIN
    IF NEW.role <> OLD.role AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: User roles can only be updated by administrators.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_check_profile_role ON public.profiles;
CREATE TRIGGER tr_check_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_update();

-- Automatic profile creation on signup (always student role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, full_name)
    VALUES (
        new.id,
        new.email,
        'student',
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Tests Table Lockdown
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

-- Safely add missing columns if the tests table already existed
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS positive_marks NUMERIC NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS negative_marks NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published tests" ON public.tests;
DROP POLICY IF EXISTS "Anyone authenticated can view published tests" ON public.tests;
DROP POLICY IF EXISTS "Students can view published tests, admins can view all" ON public.tests;

CREATE POLICY "Students can view published tests, admins can view all"
ON public.tests FOR SELECT TO authenticated
USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can modify tests" ON public.tests;
DROP POLICY IF EXISTS "Only admins can insert tests" ON public.tests;
DROP POLICY IF EXISTS "Only admins can update tests" ON public.tests;
DROP POLICY IF EXISTS "Only admins can delete tests" ON public.tests;

CREATE POLICY "Only admins can insert tests"
ON public.tests FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update tests"
ON public.tests FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete tests"
ON public.tests FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_tests_published_schedule ON public.tests(is_published, start_time, end_time);

-- 4. Questions Table Lockdown & Safe View
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

-- Safely add missing columns if questions table already existed
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS correct_option_index INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS solution TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view questions" ON public.questions;
DROP POLICY IF EXISTS "Public can view questions without answers" ON public.questions;
DROP POLICY IF EXISTS "Admins can view all questions, students can view questions after submitting" ON public.questions;

CREATE POLICY "Admins can view all questions, students can view questions after submitting"
ON public.questions FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR
    EXISTS (
        SELECT 1 FROM public.test_results tr
        WHERE tr.test_id = questions.test_id
          AND tr.student_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Only admins can modify questions" ON public.questions;
DROP POLICY IF EXISTS "Only admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Only admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Only admins can delete questions" ON public.questions;

CREATE POLICY "Only admins can insert questions"
ON public.questions FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update questions"
ON public.questions FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete questions"
ON public.questions FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_questions_test_id ON public.questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_test_topic ON public.questions(test_id, topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);

-- Safe Student View: strictly omits correct_option_index and solution
CREATE OR REPLACE VIEW public.student_questions AS
SELECT 
    q.id,
    q.test_id,
    q.statement,
    q.options,
    q.topic,
    q.difficulty,
    q.image_url,
    q.created_at
FROM public.questions q
JOIN public.tests t ON q.test_id = t.id
WHERE t.is_published = true;

GRANT SELECT ON public.student_questions TO authenticated;

-- 5. Attempts Table Lockdown
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    strikes INTEGER NOT NULL DEFAULT 0,
    result_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_test_attempt UNIQUE (user_id, test_id)
);

ALTER TABLE public.attempts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS strikes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS result_id UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_test_attempt'
    ) THEN
        ALTER TABLE public.attempts ADD CONSTRAINT unique_user_test_attempt UNIQUE (user_id, test_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students can view own attempts, admins can view all" ON public.attempts;

CREATE POLICY "Students can view own attempts, admins can view all"
ON public.attempts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Students can insert their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students can insert own attempts, admins can insert any" ON public.attempts;

CREATE POLICY "Students can insert own attempts, admins can insert any"
ON public.attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Students can update their own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Students can update own attempts, admins can update any" ON public.attempts;

CREATE POLICY "Students can update own attempts, admins can update any"
ON public.attempts FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete attempts" ON public.attempts;
CREATE POLICY "Only admins can delete attempts"
ON public.attempts FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON public.attempts(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.attempts(status);

-- 6. Test Results Table Lockdown
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total_attempted INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.test_results
ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_attempted INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_correct INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own test results" ON public.test_results;
DROP POLICY IF EXISTS "Admins can view all test results" ON public.test_results;
DROP POLICY IF EXISTS "Students can view own test results, admins can view all" ON public.test_results;

CREATE POLICY "Students can view own test results, admins can view all"
ON public.test_results FOR SELECT TO authenticated
USING (auth.uid() = student_id OR public.is_admin());

DROP POLICY IF EXISTS "Students can insert their own test results" ON public.test_results;
DROP POLICY IF EXISTS "Students can insert own test results, admins can insert any" ON public.test_results;

CREATE POLICY "Students can insert own test results, admins can insert any"
ON public.test_results FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can update test results" ON public.test_results;
CREATE POLICY "Only admins can update test results"
ON public.test_results FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete test results" ON public.test_results;
CREATE POLICY "Only admins can delete test results"
ON public.test_results FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);

-- 7. Atomic Server-Side Grading RPC
CREATE OR REPLACE FUNCTION public.grade_and_submit_exam(
    p_test_id UUID,
    p_answers JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_test RECORD;
    v_existing_result UUID;
    v_score NUMERIC := 0;
    v_correct INTEGER := 0;
    v_attempted INTEGER := 0;
    v_q RECORD;
    v_student_ans TEXT;
    v_new_result_id UUID;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '40100';
    END IF;

    -- Verify test exists and is published
    SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Examination not found.' USING ERRCODE = '40400';
    END IF;

    IF v_test.is_published = false THEN
        RAISE EXCEPTION 'This examination is currently a draft and has not been published.' USING ERRCODE = '40301';
    END IF;

    -- Verify student has not already completed this examination
    SELECT id INTO v_existing_result FROM public.test_results
    WHERE student_id = v_user_id AND test_id = p_test_id;
    IF FOUND THEN
        RAISE EXCEPTION 'You have already completed and submitted this examination.' USING ERRCODE = '40302';
    END IF;

    -- Grade all questions against verified answer key
    FOR v_q IN SELECT id, correct_option_index FROM public.questions WHERE test_id = p_test_id LOOP
        v_student_ans := p_answers->>v_q.id::text;
        IF v_student_ans IS NOT NULL AND v_student_ans <> '' THEN
            v_attempted := v_attempted + 1;
            IF (v_student_ans)::integer = v_q.correct_option_index THEN
                v_score := v_score + COALESCE(v_test.positive_marks, 4);
                v_correct := v_correct + 1;
            ELSE
                v_score := v_score - COALESCE(v_test.negative_marks, 1);
            END IF;
        END IF;
    END LOOP;

    -- Record official score in test_results
    INSERT INTO public.test_results (
        student_id,
        test_id,
        score,
        total_attempted,
        total_correct,
        answers,
        created_at
    )
    VALUES (
        v_user_id,
        p_test_id,
        v_score::integer,
        v_attempted,
        v_correct,
        COALESCE(p_answers, '{}'::jsonb),
        v_now
    )
    RETURNING id INTO v_new_result_id;

    -- Update or insert attempts record
    INSERT INTO public.attempts (
        user_id,
        test_id,
        status,
        started_at,
        submitted_at,
        result_id
    )
    VALUES (
        v_user_id,
        p_test_id,
        'completed',
        v_now,
        v_now,
        v_new_result_id
    )
    ON CONFLICT (user_id, test_id)
    DO UPDATE SET
        status = 'completed',
        submitted_at = v_now,
        result_id = v_new_result_id;

    RETURN jsonb_build_object(
        'id', v_new_result_id,
        'score', v_score::integer,
        'total_attempted', v_attempted,
        'total_correct', v_correct,
        'created_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.grade_and_submit_exam(UUID, JSONB) TO authenticated;
