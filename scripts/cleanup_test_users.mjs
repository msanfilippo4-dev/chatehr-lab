#!/usr/bin/env node
/**
 * Remove every course account created by automated tests
 * (enrollment_status = 'test' or e2e-*@fordham.edu). Cascades to workspaces,
 * progress, events, submissions, versions, rubric rows, grade events, and snapshots.
 * Also removes private EHR Go upload files and records belonging to these test accounts.
 *
 * Usage: node scripts/cleanup_test_users.mjs [--dry-run]
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

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
const uploadPrefix = "fall-2026/ehrgo/uploads";
const bucket = admin.storage.from("fordms-course-materials");
const testOwners = new Set(emails);
const uploadObjects = new Set();
for (const folder of ["pending", "ready/student", "ready/instructor"]) {
  const prefix = `${uploadPrefix}/records/${folder}`;
  for (let offset = 0; ; offset += 100) {
    const { data: files, error: listError } = await bucket.list(prefix, { limit: 100, offset });
    if (listError) { console.error("Could not list test uploads:", listError.message); process.exit(1); }
    for (const file of files ?? []) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(file.name)) continue;
      const path = `${prefix}/${file.name}`;
      const { data: blob, error: readError } = await bucket.download(path);
      if (readError || !blob || blob.size > 4096) { console.error("Could not read an upload record for cleanup."); process.exit(1); }
      const record = JSON.parse(await blob.text());
      if (!testOwners.has(record.uploadedBy)) continue;
      if (record.id !== file.name.slice(0, -5) || !new RegExp(`^${uploadPrefix}/${record.id}\\.[a-z0-9]+$`, "i").test(record.storagePath)) {
        console.error("Unexpected test upload path; cleanup stopped."); process.exit(1);
      }
      uploadObjects.add(path); uploadObjects.add(record.storagePath);
    }
    if ((files ?? []).length < 100) break;
  }
}
const submissionPrefix = "fall-2026/ehrgo/submissions";
const submissionFolders = ["pending", ...emails.map((email) => `ready/${createHash("sha256").update(email).digest("hex")}`)];
for (const folder of submissionFolders) {
  const prefix = `${submissionPrefix}/${folder}`;
  for (let offset = 0; ; offset += 100) {
    const { data: files, error: listError } = await bucket.list(prefix, { limit: 100, offset });
    if (listError) { console.error("Could not list test answer sheets:", listError.message); process.exit(1); }
    for (const file of files ?? []) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(file.name)) continue;
      const path = `${prefix}/${file.name}`;
      const { data: blob, error: readError } = await bucket.download(path);
      if (readError || !blob || blob.size > 4096) { console.error("Could not read a test answer-sheet record."); process.exit(1); }
      const record = JSON.parse(await blob.text());
      if (!testOwners.has(record.email)) continue;
      if (record.id !== file.name.slice(0, -5) || !new RegExp(`^${submissionPrefix}/files/${record.id}\\.[a-z0-9]+$`, "i").test(record.storagePath)) {
        console.error("Unexpected test answer-sheet path; cleanup stopped."); process.exit(1);
      }
      uploadObjects.add(path); uploadObjects.add(record.storagePath);
    }
    if ((files ?? []).length < 100) break;
  }
}
const paths = [...uploadObjects];
for (let start = 0; start < paths.length; start += 100) {
  const { error: removeError } = await bucket.remove(paths.slice(start, start + 100));
  if (removeError) { console.error("Could not remove test uploads:", removeError.message); process.exit(1); }
}
if (paths.length) console.log(`Removed ${paths.length} test upload objects.`);
await admin.from("ehr_admin_events").delete().in("action", ["ehrgo.material_uploaded", "ehrgo.answer_sheet_submitted"]).in("actor", emails);
const { error: deleteError } = await admin.from("ehr_course_users").delete().in("email", emails);
if (deleteError) {
  console.error("Cleanup failed:", deleteError.message);
  process.exit(1);
}
await admin.from("ehr_rate_limits").delete().like("bucket", "%e2e-%");
const { count } = await admin.from("ehr_course_users").select("email", { count: "exact", head: true }).eq("enrollment_status", "test");
console.log(`Removed ${emails.length} test account(s); ${count ?? 0} remain flagged as test.`);
