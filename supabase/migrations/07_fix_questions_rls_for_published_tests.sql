-- ================================================================
-- Migration: 07_fix_questions_rls_for_published_tests.sql
-- Description:
--   Fixes Row-Level Security on public.questions so that authenticated
--   students can view questions for published tests.
--   This ensures:
--     1. Student portal (/student/tests) displays accurate question count and total marks.
--     2. Start button is enabled for published tests that have questions.
--     3. /api/exam/start and /api/submit-exam can verify questions correctly.
-- ================================================================

-- 1. Update RLS policy on public.questions
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

-- 2. Ensure student_questions view is granted to authenticated
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

-- 3. Provide high-performance RPC to return available tests with question count
CREATE OR REPLACE FUNCTION public.get_student_tests()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'title', t.title,
                    'duration_minutes', t.duration_minutes,
                    'positive_marks', t.positive_marks,
                    'negative_marks', t.negative_marks,
                    'is_published', t.is_published,
                    'start_time', t.start_time,
                    'end_time', t.end_time,
                    'questions', (
                        SELECT COALESCE(
                            jsonb_agg(jsonb_build_object('id', q.id)),
                            '[]'::jsonb
                        )
                        FROM public.questions q
                        WHERE q.test_id = t.id
                    )
                ) ORDER BY t.created_at DESC
            ),
            '[]'::jsonb
        )
        FROM public.tests t
        WHERE t.is_published = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_student_tests() TO authenticated;
