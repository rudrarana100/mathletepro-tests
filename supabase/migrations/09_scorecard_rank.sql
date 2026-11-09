-- Migration 09: Test Result Ranking and Percentile Function
-- Computes rank and percentile in SQL strictly excluding admin accounts.
-- Only returns rank and percentile when total student attempts >= 5.

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
    -- 1. Get test_id and score for this result
    SELECT test_id, score INTO v_test_id, v_user_score
    FROM public.test_results
    WHERE id = p_result_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('available', false);
    END IF;

    -- 2. Count total submitted student attempts (strictly excluding admin accounts)
    SELECT COUNT(*) INTO v_total_attempts
    FROM public.test_results tr
    JOIN public.profiles p ON tr.student_id = p.id
    WHERE tr.test_id = v_test_id
      AND p.role != 'admin';

    -- 3. Require at least 5 submitted attempts
    IF v_total_attempts < 5 THEN
        RETURN jsonb_build_object(
            'available', false,
            'total_attempts', v_total_attempts
        );
    END IF;

    -- 4. Rank: 1 + number of students with a strictly higher score
    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.test_results tr
    JOIN public.profiles p ON tr.student_id = p.id
    WHERE tr.test_id = v_test_id
      AND p.role != 'admin'
      AND tr.score > v_user_score;

    -- 5. Percentile: (students with a lower score / total attempts) * 100, rounded
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
