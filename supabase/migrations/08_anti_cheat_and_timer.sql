-- ================================================================
-- Migration: 08_anti_cheat_and_timer.sql
-- Description:
--   1. Adds tests.max_strikes (default 3, 0 = disabled)
--   2. Enforces attempts.started_at as TIMESTAMPTZ (UTC)
--   3. Adds submission_reason to attempts and test_results
--   4. Updates start_exam_attempt RPC to support 'init' vs 'begin' actions
--   5. Updates grade_and_submit_exam RPC to enforce 15s grace period and record submission reason
-- ================================================================

-- 1. Add max_strikes to public.tests
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS max_strikes INTEGER NOT NULL DEFAULT 3;

-- 2. Ensure attempts.started_at is TIMESTAMPTZ and add submission_reason
ALTER TABLE public.attempts
ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';

ALTER TABLE public.attempts
ADD COLUMN IF NOT EXISTS submission_reason TEXT;

ALTER TABLE public.test_results
ADD COLUMN IF NOT EXISTS submission_reason TEXT;

-- 3. Atomic Attempt Starter RPC: start_exam_attempt
-- Supports p_action: 'init' (inspects status without creating attempt)
--               and 'begin' (creates attempt record and starts clock)
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

    -- Fetch test metadata including max_strikes
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

    -- No existing attempt found.
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

-- 4. Atomic Server-Side Grading RPC: grade_and_submit_exam
-- Accepts p_reason ('student_submitted', 'time_expired', 'strike_limit_exceeded')
-- Enforces duration + 15 seconds grace period
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

    -- Fetch attempt to check duration grace period (15 seconds)
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
        v_score,
        v_attempted,
        v_correct,
        p_answers,
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
        'success', true,
        'id', v_new_result_id,
        'score', v_score,
        'total_attempted', v_attempted,
        'total_correct', v_correct,
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.grade_and_submit_exam(UUID, JSONB, TEXT) TO authenticated;
