#!/usr/bin/env node
/**
 * Pre-enroll students so they appear in the roster (status "invited") before their first sign-in.
 * Usage: node scripts/enroll_students.mjs roster.txt   (lines like: First Last <id@fordham.edu>)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try { for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* env only */ }
}
const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/enroll_students.mjs roster.txt"); process.exit(1); }
const rows = readFileSync(file, "utf8").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
  const match = line.match(/^(.*?)\s*<([^>]+)>/) ?? [null, "", line];
  const name = match[1].trim().replace(/,$/, "");
  const email = match[2].trim().toLowerCase().replace(/,$/, "");
  const parts = name.split(/\s+/);
  return { email, name: name || email.split("@")[0], first_name: parts.slice(0, -1).join(" ") || parts[0] || null, last_name: parts.length > 1 ? parts[parts.length - 1] : null };
}).filter((row) => row.email.endsWith("@fordham.edu"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let added = 0, kept = 0;
for (const row of rows) {
  const { data: existing } = await admin.from("ehr_course_users").select("email,enrollment_status,role").eq("email", row.email).maybeSingle();
  if (existing) { kept += 1; await admin.from("ehr_course_users").update({ first_name: row.first_name, last_name: row.last_name, name: row.name }).eq("email", row.email); continue; }
  const { error } = await admin.from("ehr_course_users").insert({ email: row.email, name: row.name, first_name: row.first_name, last_name: row.last_name, role: "student", enrollment_status: "invited" });
  if (error) { console.error("failed", row.email, error.message); continue; }
  added += 1;
}
await admin.from("ehr_admin_events").insert({ actor: "scripts/enroll_students", action: "roster_import", target_type: "roster", target_id: file, detail: { added, updated: kept } });
console.log(`Roster: ${added} added as invited, ${kept} existing updated with names.`);
