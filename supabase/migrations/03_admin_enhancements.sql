-- ================================================================
-- Migration: 03_admin_enhancements.sql
-- Description: Adds scheduling and publication fields to tests,
--              and topic, difficulty, image_url to questions.
-- ================================================================

-- 1. Extend tests table
ALTER TABLE public.tests
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Index for querying published tests and schedules
CREATE INDEX IF NOT EXISTS idx_tests_published_schedule ON public.tests(is_published, start_time, end_time);

-- 2. Extend questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Index for filtering questions by test and topic
CREATE INDEX IF NOT EXISTS idx_questions_test_topic ON public.questions(test_id, topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
