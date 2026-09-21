-- Allow cascading deletes of submission versions (account removal, test-user cleanup)
-- while keeping rows immutable to UPDATE. Idempotent.
CREATE OR REPLACE FUNCTION ehr_submission_versions_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ehr_submission_versions rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ehr_submission_versions_immutable ON ehr_submission_versions;
CREATE TRIGGER trg_ehr_submission_versions_immutable
  BEFORE UPDATE ON ehr_submission_versions
  FOR EACH ROW EXECUTE FUNCTION ehr_submission_versions_immutable();
