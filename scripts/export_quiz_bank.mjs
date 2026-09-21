#!/usr/bin/env node
/** Export the weekly quiz bank from the course manifest into a server-only JSON file. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const manifestPath = resolve(process.argv[2] ?? "../manifest/course_manifest.json");
const out = resolve("lib/server/quiz-bank.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bank = manifest.weeks.map((week) => ({
  week: week.week,
  title: week.title,
  date: week.date,
  dueAt: week.due ?? null,
  graded: String(week.quiz_type).toLowerCase() === "graded",
  items: week.quiz.map((item) => ({ id: item.id, question: item.question, options: item.options, correct: item.correct, rationale: item.rationale, kind: item.kind ?? null, objective: item.objective ?? null })),
}));
for (const week of bank) { if (week.items.length !== 6 || week.items.some((i) => i.options.length !== 4)) throw new Error(`Week ${week.week}: expected 6 items with 4 options`); }
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), source: "manifest/course_manifest.json", weeks: bank }, null, 2) + "\n");
console.log(`Wrote ${bank.length} weekly quizzes (${bank.filter((w) => w.graded).length} graded) to lib/server/quiz-bank.json`);
