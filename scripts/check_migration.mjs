#!/usr/bin/env node
/** Verify that migrations 009, 011, and 012 have been applied to the configured Supabase project. */
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

/** Check a list of [table, columns] pairs and report the migration's status. */
async function checkMigration(label, list) {
  let missing = 0;
  for (const [table, column] of list) {
    const { error } = await admin.from(table).select(column).limit(1);
    console.log(`${error ? "MISSING" : "ok     "} ${table}.${column}${error ? ` (${error.message})` : ""}`);
    if (error) missing += 1;
  }
  console.log(missing ? `Migration ${label} is NOT fully applied (${missing} missing).` : `Migration ${label} is applied.`);
  return missing;
}

failed += await checkMigration("011 (quizzes)", [["ehr_quiz_attempts", "id,email,week,attempt,answers,score,late,submitted_at"]]);
failed += await checkMigration("012 (quiz windows)", [
  ["ehr_quiz_attempts", "status"],
  ["ehr_quiz_attempts", "drawn_item_ids"],
  ["ehr_quiz_attempts", "option_orders"],
  ["ehr_quiz_attempts", "saved_answers"],
  ["ehr_quiz_attempts", "expires_at"],
  ["ehr_quiz_settings", "week,opens_at,closes_at,time_limit_min,draw_count,attempts_allowed,show_answers,updated_by,updated_at"],
  ["ehr_quiz_extensions", "email,week,extra_minutes,closes_at_override,reason,created_by,created_at"],
]);
process.exit(failed ? 1 : 0);
