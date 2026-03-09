-- ============================================================================
-- 004_realtime.sql
-- Enable Supabase Realtime on tables that need live updates
-- ============================================================================

-- Enable realtime for benchmark_runs so the UI can subscribe to status changes
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_runs;
