#!/usr/bin/env node
/** Verify that migration 009 has been applied to the configured Supabase project. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch { /* rely on env */ }
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checks = [
  ["ehr_config_versions", "version"],
  ["ehr_admin_events", "id"],
  ["ehr_assignment_releases", "assignment_id"],
  ["ehr_submission_versions", "id"],
  ["ehr_rubric_scores", "id"],
  ["ehr_grade_events", "id"],
  ["ehr_workspace_snapshots", "id"],
  ["ehr_rate_limits", "bucket"],
  ["ehr_course_users", "enrollment_status"],
  ["ehr_activity_events", "provenance"],
  ["ehr_user_workspaces", "reset_markers"],
  ["ehr_assignment_submissions", "rubric_total"],
];
let failed = 0;
for (const [table, column] of checks) {
  const { error } = await admin.from(table).select(column).limit(1);
  console.log(`${error ? "MISSING" : "ok     "} ${table}.${column}${error ? ` (${error.message})` : ""}`);
  if (error) failed += 1;
}
const releases = await admin.from("ehr_assignment_releases").select("assignment_id,due_at").order("assignment_id");
if (!releases.error) console.log("releases:", (releases.data ?? []).map((row) => `${row.assignment_id}=${row.due_at}`).join(", "));
const rpc = await admin.rpc("ehr_rate_limit_hit", { p_bucket: "check:migration", p_limit: 1000, p_window_seconds: 60 });
console.log(`${rpc.error ? "MISSING" : "ok     "} function ehr_rate_limit_hit${rpc.error ? ` (${rpc.error.message})` : ""}`);
if (rpc.error) failed += 1;
console.log(failed ? `Migration 009 is NOT fully applied (${failed} missing).` : "Migration 009 is applied.");
process.exit(failed ? 1 : 0);
