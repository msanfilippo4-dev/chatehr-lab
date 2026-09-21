#!/usr/bin/env node
/**
 * Remove every course account created by automated tests
 * (enrollment_status = 'test' or e2e-*@fordham.edu). Cascades to workspaces,
 * progress, events, submissions, versions, rubric rows, grade events, and snapshots.
 *
 * Usage: node scripts/cleanup_test_users.mjs [--dry-run]
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch {
    // no .env.local; rely on process env
  }
}

loadEnv();
const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Supabase credentials are not configured.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.from("ehr_course_users").select("email,enrollment_status").or("enrollment_status.eq.test,email.like.e2e-%@fordham.edu");
if (error) {
  console.error("Could not list test users:", error.message);
  process.exit(1);
}
const emails = (data ?? []).map((row) => row.email).filter((email) => email.startsWith("e2e-") || email.includes("+e2e"));
console.log(`${emails.length} test account(s) found${dryRun ? " (dry run)" : ""}.`);
if (!emails.length || dryRun) process.exit(0);
const { error: deleteError } = await admin.from("ehr_course_users").delete().in("email", emails);
if (deleteError) {
  console.error("Cleanup failed:", deleteError.message);
  process.exit(1);
}
await admin.from("ehr_rate_limits").delete().like("bucket", "%e2e-%");
const { count } = await admin.from("ehr_course_users").select("email", { count: "exact", head: true }).eq("enrollment_status", "test");
console.log(`Removed ${emails.length} test account(s); ${count ?? 0} remain flagged as test.`);
