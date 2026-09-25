-- Rollback for 012_fordms_quiz_windows.sql.
-- Loses quiz settings, extensions, draws, and option orders. Finalized attempts
-- (submitted / auto_submitted) keep their scores. Attempts still in progress have
-- no score and are deleted so that submitted_at can be made NOT NULL again.
-- Note: after rollback the app treats every attempt as a fixed-order attempt, so
-- per-question review of drawn attempts would no longer line up (scores do).

DROP TABLE IF EXISTS ehr_quiz_extensions;
DROP TABLE IF EXISTS ehr_quiz_settings;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ehr_quiz_attempts' AND column_name = 'status'
  ) THEN
    DELETE FROM ehr_quiz_attempts WHERE status = 'in_progress';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_ehr_quiz_attempts_one_open;
DROP INDEX IF EXISTS idx_ehr_quiz_attempts_open_expiry;
ALTER TABLE ehr_quiz_attempts DROP CONSTRAINT IF EXISTS ehr_quiz_attempts_submitted_check;
ALTER TABLE ehr_quiz_attempts DROP CONSTRAINT IF EXISTS ehr_quiz_attempts_status_check;

UPDATE ehr_quiz_attempts SET submitted_at = COALESCE(started_at, now()) WHERE submitted_at IS NULL;
ALTER TABLE ehr_quiz_attempts ALTER COLUMN submitted_at SET DEFAULT now();
ALTER TABLE ehr_quiz_attempts ALTER COLUMN submitted_at SET NOT NULL;

ALTER TABLE ehr_quiz_attempts
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS saved_answers,
  DROP COLUMN IF EXISTS option_orders,
  DROP COLUMN IF EXISTS drawn_item_ids,
  DROP COLUMN IF EXISTS status;

NOTIFY pgrst, 'reload schema';
