#!/usr/bin/env node
/**
 * Validate the authored quiz bank and install it as lib/server/quiz-bank.json.
 *
 *   npm run import:quiz-bank                 # reads ../../v5final/quiz-bank.json
 *   npm run import:quiz-bank -- path/to/bank.json
 *
 * Weeks missing from the bank show to students as "not yet available". Legacy
 * weeks are checked against lib/server/quiz-bank.legacy-w01.json so attempts
 * already stored (answers index-aligned to the legacy order) stay correct.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuizBank } from "./quiz_bank_validate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? resolve(root, "../../v5final/quiz-bank.json"));
const target = resolve(root, "lib/server/quiz-bank.json");
const legacyPath = resolve(root, "lib/server/quiz-bank.legacy-w01.json");

if (!existsSync(source)) {
  console.error(`Quiz bank not found: ${source}`);
  process.exit(1);
}
const bank = JSON.parse(readFileSync(source, "utf8"));
const legacy = existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, "utf8")) : null;
const errors = validateQuizBank(bank, { legacy });
if (errors.length) {
  console.error(`Quiz bank is invalid (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

// Warn when a non-legacy week's first items change: attempts made before
// migration 012 (fixed mode) are read as "the first N items in bank order".
if (existsSync(target)) {
  const current = JSON.parse(readFileSync(target, "utf8"));
  for (const week of bank.weeks) {
    const before = (current.weeks ?? []).find((item) => item.week === week.week);
    if (!before || week.legacy) continue;
    const draw = week.draw ?? bank.policy.draw;
    const oldIds = (before.items ?? []).slice(0, draw).map((item) => item.id).join(",");
    const newIds = week.items.slice(0, draw).map((item) => item.id).join(",");
    if (oldIds && oldIds !== newIds) console.warn(`Warning: week ${week.week}'s first ${draw} items changed order; fixed-mode attempts made before migration 012 will be reviewed against the new order.`);
  }
}

writeFileSync(target, `${JSON.stringify(bank, null, 2)}\n`);
const weeks = bank.weeks.map((week) => `W${week.week}${week.graded ? "*" : ""}${week.legacy ? " (legacy)" : ""}: ${week.items.length} items`);
console.log(`Installed ${bank.weeks.length} week(s) into lib/server/quiz-bank.json (* = graded)`);
for (const line of weeks) console.log(`  ${line}`);
const missing = Array.from({ length: 12 }, (_, index) => index + 1).filter((week) => !bank.weeks.some((item) => item.week === week));
if (missing.length) console.log(`Not yet available: weeks ${missing.join(", ")}`);
console.log("Rebuild and redeploy for students to see the change.");
