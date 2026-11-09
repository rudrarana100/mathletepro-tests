-- ================================================================
-- Mathlete Pro: Consolidated Master Production Schema & RLS Lockdown
-- ================================================================
-- Execute this complete script in the Supabase SQL Editor.
-- It safely upgrades existing tables (adding any missing columns),
-- creates recursive-safe is_admin() helper, applies row-level security
-- policies across all tables, creates the safe student_questions view,
-- and registers atomic server-side RPCs for starting and grading exams.
-- Idempotent: can be executed safely multiple times.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helper Function: is_admin()
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ----------------------------------------------------------------
-- 2. Profiles Table & Security
-- ----------------------------------------------------------------
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

DROP POLICY IF EXISTS "Users can read own profile, admins can read all" ON public.profiles;
CREATE POLICY "Users can read own profile, admins can read all"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_admin());

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

-- Auto-create profile on signup (always student)
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

-- ----------------------------------------------------------------
-- 3. Tests Table & Security
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    positive_marks NUMERIC NOT NULL DEFAULT 4,
    negative_marks NUMERIC NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT true,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    max_strikes INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS positive_marks NUMERIC NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS negative_marks NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_strikes INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view published tests, admins can view all" ON public.tests;
CREATE POLICY "Students can view published tests, admins can view all"
ON public.tests FOR SELECT TO authenticated
USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can insert tests" ON public.tests;
CREATE POLICY "Only admins can insert tests"
ON public.tests FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update tests" ON public.tests;
CREATE POLICY "Only admins can update tests"
ON public.tests FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete tests" ON public.tests;
CREATE POLICY "Only admins can delete tests"
ON public.tests FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_tests_published_schedule ON public.tests(is_published, start_time, end_time);

-- ----------------------------------------------------------------
-- 4. Questions Table, Security & Safe View
-- ----------------------------------------------------------------
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

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS correct_option_index INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS solution TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all questions, students can view after test submission" ON public.questions;
DROP POLICY IF EXISTS "Admins can view all questions, students can view questions after submitting" ON public.questions;
DROP POLICY IF EXISTS "Anyone authenticated can view questions for published tests" ON public.questions;
DROP POLICY IF EXISTS "Students can view questions for published tests, admins can view all" ON public.questions;

CREATE POLICY "Students can view questions for published tests, admins can view all"
ON public.questions FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR
    EXISTS (
        SELECT 1 FROM public.tests t
        WHERE t.id = questions.test_id
          AND t.is_published = true
    )
    OR
    EXISTS (
        SELECT 1 FROM public.test_results tr
        WHERE tr.test_id = questions.test_id
          AND tr.student_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Only admins can insert questions" ON public.questions;
CREATE POLICY "Only admins can insert questions"
ON public.questions FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update questions" ON public.questions;
CREATE POLICY "Only admins can update questions"
ON public.questions FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete questions" ON public.questions;
CREATE POLICY "Only admins can delete questions"
ON public.questions FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_questions_test_id ON public.questions(test_id);

-- Safe View: student_questions (No answers or explanations leaked)
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

-- ----------------------------------------------------------------
-- 5. Attempts Table & Security
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    strikes INTEGER NOT NULL DEFAULT 0,
    result_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_test_attempt UNIQUE (user_id, test_id)
);

ALTER TABLE public.attempts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
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

DROP POLICY IF EXISTS "Students can view own attempts, admins can view all" ON public.attempts;
CREATE POLICY "Students can view own attempts, admins can view all"
ON public.attempts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Students can insert own attempts, admins can insert any" ON public.attempts;
CREATE POLICY "Students can insert own attempts, admins can insert any"
ON public.attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

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

-- ----------------------------------------------------------------
-- 6. Attempt Answers Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    selected_option INTEGER,
    is_reviewed BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attempt answers" ON public.attempt_answers;
CREATE POLICY "Users can view own attempt answers"
ON public.attempt_answers FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.id = attempt_answers.attempt_id
          AND (a.user_id = auth.uid() OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Users can write own attempt answers" ON public.attempt_answers;
CREATE POLICY "Users can write own attempt answers"
ON public.attempt_answers FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.id = attempt_answers.attempt_id
          AND (a.user_id = auth.uid() OR public.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.id = attempt_answers.attempt_id
          AND (a.user_id = auth.uid() OR public.is_admin())
    )
);

-- ----------------------------------------------------------------
-- 7. Test Results Table & Scoring Lockdown
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total_attempted INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_student_test_result UNIQUE (student_id, test_id)
);

ALTER TABLE public.test_results
ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_attempted INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_correct INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_student_test_result'
    ) THEN
        ALTER TABLE public.test_results ADD CONSTRAINT unique_student_test_result UNIQUE (student_id, test_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own test results, admins can view all" ON public.test_results;
CREATE POLICY "Students can view own test results, admins can view all"
ON public.test_results FOR SELECT TO authenticated
USING (auth.uid() = student_id OR public.is_admin());

-- Direct student insert revoked: scores can ONLY be inserted by admins or via the grading RPC
DROP POLICY IF EXISTS "Only admins can insert test results" ON public.test_results;
CREATE POLICY "Only admins can insert test results"
ON public.test_results FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

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

-- ----------------------------------------------------------------
-- 8. Analytics Events Table & Security
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert own analytics events" ON public.analytics_events;
CREATE POLICY "Authenticated users can insert own analytics events"
ON public.analytics_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can view analytics events" ON public.analytics_events;
CREATE POLICY "Only admins can view analytics events"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------
-- 9. Atomic Attempt Starter RPC: start_exam_attempt
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_exam_attempt(UUID, TEXT);
DROP FUNCTION IF EXISTS public.start_exam_attempt(UUID);
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
    p_test_id UUID,
    p_action TEXT DEFAULT 'begin'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_test RECORD;
    v_attempt RECORD;
    v_result RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_end_time TIMESTAMPTZ;
    v_remaining_seconds INTEGER;
    v_questions JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '40100';
    END IF;

    -- Fetch test metadata
    SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Examination not found.' USING ERRCODE = '40400';
    END IF;

    IF v_test.is_published = false AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'This examination is currently a draft.' USING ERRCODE = '40301';
    END IF;

    -- Check if student has already completed and submitted this test
    SELECT * INTO v_result FROM public.test_results
    WHERE student_id = v_user_id AND test_id = p_test_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'alreadyCompleted', true,
            'resultId', v_result.id,
            'score', v_result.score
        );
    END IF;

    -- Extract safe questions (omitting correct_option_index and solution)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', q.id,
                'statement', q.statement,
                'options', q.options,
                'topic', q.topic,
                'difficulty', q.difficulty,
                'image_url', q.image_url
            ) ORDER BY q.created_at ASC
        ),
        '[]'::jsonb
    ) INTO v_questions
    FROM public.questions q
    WHERE q.test_id = p_test_id;

    -- Check for an existing attempt
    SELECT * INTO v_attempt FROM public.attempts
    WHERE user_id = v_user_id AND test_id = p_test_id;

    IF FOUND THEN
        IF v_attempt.status = 'completed' AND v_attempt.result_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'alreadyCompleted', true,
                'resultId', v_attempt.result_id
            );
        END IF;

        -- Calculate remaining time from server-pinned end_time
        IF v_attempt.end_time IS NOT NULL THEN
            v_remaining_seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_attempt.end_time - v_now))))::integer;
        ELSE
            v_remaining_seconds := (COALESCE(v_test.duration_minutes, 60) * 60);
            v_end_time := v_attempt.started_at + (COALESCE(v_test.duration_minutes, 60) || ' minutes')::interval;
            UPDATE public.attempts SET end_time = v_end_time WHERE id = v_attempt.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'hasActiveAttempt', true,
            'test', jsonb_build_object(
                'id', v_test.id,
                'title', v_test.title,
                'duration_minutes', v_test.duration_minutes,
                'positive_marks', v_test.positive_marks,
                'negative_marks', v_test.negative_marks,
                'max_strikes', COALESCE(v_test.max_strikes, 3)
            ),
            'questions', v_questions,
            'remainingSeconds', v_remaining_seconds,
            'serverNow', v_now,
            'startedAt', v_attempt.started_at,
            'endTime', v_attempt.end_time,
            'strikes', COALESCE(v_attempt.strikes, 0)
        );
    END IF;

    -- If p_action = 'init', do NOT create attempt yet. Return metadata so client can show instructions screen.
    IF p_action = 'init' THEN
        RETURN jsonb_build_object(
            'success', true,
            'hasActiveAttempt', false,
            'test', jsonb_build_object(
                'id', v_test.id,
                'title', v_test.title,
                'duration_minutes', v_test.duration_minutes,
                'positive_marks', v_test.positive_marks,
                'negative_marks', v_test.negative_marks,
                'max_strikes', COALESCE(v_test.max_strikes, 3)
            ),
            'questions', v_questions,
            'remainingSeconds', (COALESCE(v_test.duration_minutes, 60) * 60),
            'serverNow', v_now,
            'strikes', 0
        );
    END IF;

    -- First time beginning this exam (p_action = 'begin'): create official attempt record
    v_end_time := v_now + (COALESCE(v_test.duration_minutes, 60) || ' minutes')::interval;
    v_remaining_seconds := (COALESCE(v_test.duration_minutes, 60) * 60);

    INSERT INTO public.attempts (
        user_id,
        test_id,
        status,
        started_at,
        end_time,
        strikes
    )
    VALUES (
        v_user_id,
        p_test_id,
        'in_progress',
        v_now,
        v_end_time,
        0
    )
    RETURNING * INTO v_attempt;

    RETURN jsonb_build_object(
        'success', true,
        'hasActiveAttempt', true,
        'test', jsonb_build_object(
            'id', v_test.id,
            'title', v_test.title,
            'duration_minutes', v_test.duration_minutes,
            'positive_marks', v_test.positive_marks,
            'negative_marks', v_test.negative_marks,
            'max_strikes', COALESCE(v_test.max_strikes, 3)
        ),
        'questions', v_questions,
        'remainingSeconds', v_remaining_seconds,
        'serverNow', v_now,
        'startedAt', v_attempt.started_at,
        'endTime', v_attempt.end_time,
        'strikes', 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.start_exam_attempt(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------
-- 10. Atomic Server-Side Grading RPC: grade_and_submit_exam
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grade_and_submit_exam(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.grade_and_submit_exam(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.grade_and_submit_exam(
    p_test_id UUID,
    p_answers JSONB,
    p_reason TEXT DEFAULT 'student_submitted'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_test RECORD;
    v_attempt RECORD;
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

    IF v_test.is_published = false AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'This examination is currently a draft and has not been published.' USING ERRCODE = '40301';
    END IF;

    -- Verify student has not already completed this examination
    SELECT id INTO v_existing_result FROM public.test_results
    WHERE student_id = v_user_id AND test_id = p_test_id;
    IF FOUND THEN
        RAISE EXCEPTION 'You have already completed and submitted this examination.' USING ERRCODE = '40302';
    END IF;

    -- Fetch attempt
    SELECT * INTO v_attempt FROM public.attempts
    WHERE user_id = v_user_id AND test_id = p_test_id;

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

    -- Record official score in test_results with submission_reason
    INSERT INTO public.test_results (
        student_id,
        test_id,
        score,
        total_attempted,
        total_correct,
        answers,
        submission_reason,
        created_at
    )
    VALUES (
        v_user_id,
        p_test_id,
        v_score::integer,
        v_attempted,
        v_correct,
        COALESCE(p_answers, '{}'::jsonb),
        COALESCE(p_reason, 'student_submitted'),
        v_now
    )
    RETURNING id INTO v_new_result_id;

    -- Mark attempt as completed and link scorecard
    IF v_attempt.id IS NOT NULL THEN
        UPDATE public.attempts
        SET
            status = 'completed',
            submitted_at = v_now,
            result_id = v_new_result_id,
            submission_reason = COALESCE(p_reason, 'student_submitted')
        WHERE id = v_attempt.id;
    END IF;

    RETURN jsonb_build_object(
        'id', v_new_result_id,
        'score', v_score::integer,
        'total_attempted', v_attempted,
        'total_correct', v_correct,
        'reason', p_reason,
        'created_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.grade_and_submit_exam(UUID, JSONB, TEXT) TO authenticated;

-- ----------------------------------------------------------------
-- 10. Performance Indexes & Analytical SQL Functions
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON public.attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_score ON public.test_results(test_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON public.questions(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_is_published ON public.tests(is_published);

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
    total_students BIGINT,
    total_tests BIGINT,
    published_tests BIGINT,
    draft_tests BIGINT,
    total_questions BIGINT,
    total_student_attempts BIGINT,
    average_student_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH student_users AS (
        SELECT id FROM public.profiles WHERE role != 'admin'
    ),
    valid_results AS (
        SELECT tr.score FROM public.test_results tr
        JOIN student_users su ON tr.student_id = su.id
    )
    SELECT
        (SELECT COUNT(*) FROM student_users)::BIGINT AS total_students,
        (SELECT COUNT(*) FROM public.tests)::BIGINT AS total_tests,
        (SELECT COUNT(*) FROM public.tests WHERE is_published = true)::BIGINT AS published_tests,
        (SELECT COUNT(*) FROM public.tests WHERE is_published = false)::BIGINT AS draft_tests,
        (SELECT COUNT(*) FROM public.questions)::BIGINT AS total_questions,
        (SELECT COUNT(*) FROM valid_results)::BIGINT AS total_student_attempts,
        COALESCE((SELECT ROUND(AVG(score), 1) FROM valid_results), 0)::NUMERIC AS average_student_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- ----------------------------------------------------------------
-- 11. Test Result Ranking and Percentile Function
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_test_result_ranking(UUID);
CREATE OR REPLACE FUNCTION public.get_test_result_ranking(p_result_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_test_id UUID;
    v_user_score NUMERIC;
    v_total_attempts INTEGER;
    v_rank INTEGER;
    v_lower_count INTEGER;
    v_percentile NUMERIC;
BEGIN
    SELECT test_id, score INTO v_test_id, v_user_score
    FROM public.test_results
    WHERE id = p_result_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('available', false);
    END IF;

    SELECT COUNT(*) INTO v_total_attempts
    FROM public.test_results tr
    JOIN public.profiles p ON tr.student_id = p.id
    WHERE tr.test_id = v_test_id
      AND p.role != 'admin';

    IF v_total_attempts < 5 THEN
        RETURN jsonb_build_object(
            'available', false,
            'total_attempts', v_total_attempts
        );
    END IF;

    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.test_results tr
    JOIN public.profiles p ON tr.student_id = p.id
    WHERE tr.test_id = v_test_id
      AND p.role != 'admin'
      AND tr.score > v_user_score;

    SELECT COUNT(*) INTO v_lower_count
    FROM public.test_results tr
    JOIN public.profiles p ON tr.student_id = p.id
    WHERE tr.test_id = v_test_id
      AND p.role != 'admin'
      AND tr.score < v_user_score;

    v_percentile := ROUND((v_lower_count::NUMERIC / v_total_attempts::NUMERIC) * 100);

    RETURN jsonb_build_object(
        'available', true,
        'rank', v_rank,
        'total_attempts', v_total_attempts,
        'percentile', v_percentile
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_test_result_ranking(UUID) TO authenticated;


