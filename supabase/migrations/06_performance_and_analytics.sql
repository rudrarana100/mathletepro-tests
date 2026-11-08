-- ================================================================
-- Migration 06: Performance Indexes, Admin Exclusion & SQL Aggregates
-- ================================================================

-- 1. Section A.4: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON public.attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_score ON public.test_results(test_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON public.questions(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_is_published ON public.tests(is_published);

-- 2. Section B.2: Clean existing admin attempts from stats
DELETE FROM public.test_results 
WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'admin');

DELETE FROM public.attempts 
WHERE user_id IN (SELECT id FROM public.profiles WHERE role = 'admin');

-- 3. SQL Aggregates: Admin Overview KPI Stats (Excluding Admins)
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

-- 4. SQL Aggregates: Student Performance Stats
CREATE OR REPLACE FUNCTION public.get_student_stats(p_student_id UUID)
RETURNS TABLE (
    tests_completed BIGINT,
    average_score NUMERIC,
    best_score INTEGER,
    total_attempted BIGINT,
    total_correct BIGINT,
    accuracy_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH student_records AS (
        SELECT score, total_attempted, total_correct
        FROM public.test_results
        WHERE student_id = p_student_id
    )
    SELECT
        COUNT(*)::BIGINT AS tests_completed,
        COALESCE(ROUND(AVG(score), 1), 0)::NUMERIC AS average_score,
        COALESCE(MAX(score), 0)::INTEGER AS best_score,
        COALESCE(SUM(total_attempted), 0)::BIGINT AS total_attempted,
        COALESCE(SUM(total_correct), 0)::BIGINT AS total_correct,
        CASE 
            WHEN COALESCE(SUM(total_attempted), 0) > 0 
            THEN ROUND((SUM(total_correct)::NUMERIC / SUM(total_attempted)::NUMERIC) * 100, 1)
            ELSE 0 
        END::NUMERIC AS accuracy_rate
    FROM student_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_student_stats(UUID) TO authenticated;

-- 5. SQL Aggregates: Test Rank & Percentile
CREATE OR REPLACE FUNCTION public.get_student_test_rank(p_test_id UUID, p_student_id UUID)
RETURNS TABLE (
    rank BIGINT,
    total_participants BIGINT,
    percentile NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked AS (
        SELECT 
            student_id,
            score,
            RANK() OVER (ORDER BY score DESC) AS rnk,
            COUNT(*) OVER () AS total
        FROM public.test_results tr
        JOIN public.profiles p ON tr.student_id = p.id
        WHERE tr.test_id = p_test_id AND p.role != 'admin'
    )
    SELECT 
        rnk::BIGINT,
        total::BIGINT,
        ROUND(((total - rnk)::NUMERIC / GREATEST(total - 1, 1)::NUMERIC) * 100, 1)::NUMERIC AS percentile
    FROM ranked
    WHERE student_id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_student_test_rank(UUID, UUID) TO authenticated;
