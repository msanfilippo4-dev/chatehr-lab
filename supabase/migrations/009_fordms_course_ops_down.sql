-- Rollback for 009_fordms_course_ops.sql. Loses version history, rubric rows,
-- snapshots, config versions, and admin events. 008-era data remains intact.

DROP TRIGGER IF EXISTS trg_ehr_submission_versions_immutable ON ehr_submission_versions;
DROP FUNCTION IF EXISTS ehr_submission_versions_immutable();
DROP FUNCTION IF EXISTS ehr_rate_limit_hit(TEXT, INT, INT);

DROP TABLE IF EXISTS ehr_rate_limits;
DROP TABLE IF EXISTS ehr_workspace_snapshots;
DROP TABLE IF EXISTS ehr_grade_events;
DROP TABLE IF EXISTS ehr_rubric_scores;
DROP TABLE IF EXISTS ehr_submission_versions;
DROP TABLE IF EXISTS ehr_assignment_releases;
DROP TABLE IF EXISTS ehr_admin_events;
DROP TABLE IF EXISTS ehr_config_versions;

DROP INDEX IF EXISTS idx_ehr_activity_email_action_ctx;
DROP INDEX IF EXISTS idx_ehr_activity_provenance;

UPDATE ehr_assignment_submissions SET status = 'returned' WHERE status = 'revision_requested';
ALTER TABLE ehr_assignment_submissions DROP CONSTRAINT IF EXISTS ehr_assignment_submissions_status_check;
ALTER TABLE ehr_assignment_submissions ADD CONSTRAINT ehr_assignment_submissions_status_check
  CHECK (status IN ('submitted', 'graded', 'returned'));

ALTER TABLE ehr_assignment_submissions
  DROP COLUMN IF EXISTS current_version_id,
  DROP COLUMN IF EXISTS config_version,
  DROP COLUMN IF EXISTS rubric_total,
  DROP COLUMN IF EXISTS returned_at,
  DROP COLUMN IF EXISTS returned_by,
  DROP COLUMN IF EXISTS return_comment,
  DROP COLUMN IF EXISTS late;

ALTER TABLE ehr_user_workspaces
  DROP COLUMN IF EXISTS last_import_at,
  DROP COLUMN IF EXISTS last_reset_at,
  DROP COLUMN IF EXISTS reset_markers;

ALTER TABLE ehr_assignment_progress
  DROP COLUMN IF EXISTS earned_units,
  DROP COLUMN IF EXISTS imported_units,
  DROP COLUMN IF EXISTS total_units,
  DROP COLUMN IF EXISTS computed_from,
  DROP COLUMN IF EXISTS config_version,
  DROP COLUMN IF EXISTS status;

ALTER TABLE ehr_activity_events DROP CONSTRAINT IF EXISTS ehr_activity_events_provenance_check;
ALTER TABLE ehr_activity_events
  DROP COLUMN IF EXISTS provenance,
  DROP COLUMN IF EXISTS context,
  DROP COLUMN IF EXISTS actor_role;

ALTER TABLE ehr_course_users DROP CONSTRAINT IF EXISTS ehr_course_users_enrollment_status_check;
ALTER TABLE ehr_course_users
  DROP COLUMN IF EXISTS enrollment_status,
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS blackboard_username,
  DROP COLUMN IF EXISTS section,
  DROP COLUMN IF EXISTS notes;
