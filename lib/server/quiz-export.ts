/** CSV exports for weekly quizzes (Blackboard grade upload, category, attempts, item analysis). */
import { splitName, toCsv } from "@/lib/csv";
import { logAdminEvent, type AdminClient } from "./course-db";
import { ApiError } from "./errors";
import { classResults, loadClassContext, type ClassContext } from "./quiz-store";
import { attemptItems, bankWeek, itemAnalysis, parseWeekParam } from "./quizzes";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function csvResponse(csv: string, name: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fordms-${name}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function exportable(context: ClassContext, includeTest: boolean) {
  return classResults(context).students.filter((student) => student.enrollment_status === "active" || (includeTest && student.enrollment_status === "test"));
}

function names(student: { name: string | null; email: string; first_name: string | null; last_name: string | null; blackboard_username: string | null }) {
  const split = splitName(student.name, student.email);
  return {
    lastName: student.last_name ?? split.lastName,
    firstName: student.first_name ?? split.firstName,
    username: student.blackboard_username ?? student.email.split("@")[0],
  };
}

const fixed2 = (value: number | null | undefined) => (value == null ? "" : Number(value).toFixed(2));

export async function quizCsv(admin: AdminClient, actor: string, scope: string, options: { includeTest: boolean; week: string }) {
  const week = options.week ? parseWeekParam(options.week) : undefined;
  if (scope === "quiz-items" && !week) throw new ApiError(400, "Choose a week for the item analysis export.", "VALIDATION");
  const context = await loadClassContext(admin, { includeTest: options.includeTest, week });
  let csv: string;
  let name: string;
  let rowCount: number;

  if (scope === "quizzes") {
    // Blackboard Grade Center upload: best per graded week plus the category score.
    const students = exportable(context, options.includeTest);
    const graded = classResults(context).gradedWeeks;
    csv = toCsv(students, [
      { header: "Last Name", value: (row) => names(row).lastName },
      { header: "First Name", value: (row) => names(row).firstName },
      { header: "Username", value: (row) => names(row).username },
      ...graded.map((number) => ({
        header: `Quiz Week ${number} [Total Pts: 100 Score]`,
        value: (row: (typeof students)[number]) => fixed2(row.weeks.find((cell) => cell.week === number)?.best),
      })),
      { header: "Quiz category, lowest dropped [Total Pts: 100 Score]", value: (row) => fixed2(row.category.score) },
    ]);
    name = "quizzes";
    rowCount = students.length;
  } else if (scope === "quiz-category") {
    const students = exportable(context, options.includeTest);
    csv = toCsv(students, [
      { header: "Last Name", value: (row) => names(row).lastName },
      { header: "First Name", value: (row) => names(row).firstName },
      { header: "Username", value: (row) => names(row).username },
      { header: "Email", value: (row) => row.email },
      { header: "Quiz Category [Total Pts: 100 Score]", value: (row) => fixed2(row.category.score) },
      { header: "Weeks counted", value: (row) => row.category.counted },
      { header: "Dropped week", value: (row) => row.category.droppedWeek ?? "" },
      { header: "Dropped score", value: (row) => fixed2(row.category.dropped) },
    ]);
    name = "quiz-category";
    rowCount = students.length;
  } else if (scope === "quiz-attempts") {
    const byEmail = new Map(context.students.map((student) => [student.email, student]));
    const rows = context.attempts
      .filter((row) => byEmail.has(row.email))
      .sort((a, b) => a.week - b.week || a.email.localeCompare(b.email) || a.attempt - b.attempt);
    csv = toCsv(rows, [
      { header: "Email", value: (row) => row.email },
      { header: "Name", value: (row) => byEmail.get(row.email)?.name ?? "" },
      { header: "Week", value: (row) => row.week },
      { header: "Attempt", value: (row) => row.attempt },
      { header: "Status", value: (row) => row.status },
      { header: "Started", value: (row) => row.started_at ?? "" },
      { header: "Submitted", value: (row) => row.submitted_at ?? "" },
      { header: "Expires", value: (row) => row.expires_at ?? "" },
      { header: "Score", value: (row) => (row.status === "in_progress" ? "" : fixed2(row.score)) },
      { header: "Correct", value: (row) => (row.status === "in_progress" ? "" : row.correct_count) },
      { header: "Total", value: (row) => row.total },
      { header: "Late", value: (row) => (row.late ? "yes" : "") },
      {
        header: "Items",
        value: (row) => {
          const bank = bankWeek(row.week);
          return bank ? attemptItems(bank, row).map((item) => item.id).join(" ") : (row.drawn_item_ids ?? []).join(" ");
        },
      },
      { header: "Answers (original option letters)", value: (row) => row.answers.map((value) => (value == null ? "-" : LETTERS[value] ?? "?")).join(" ") },
    ]);
    name = week ? `quiz-attempts-w${week}` : "quiz-attempts";
    rowCount = rows.length;
  } else if (scope === "quiz-items") {
    const bank = bankWeek(week!);
    if (!bank) throw new ApiError(404, "That week is not in the quiz bank yet.", "NOT_FOUND");
    const emails = new Set(context.students.map((student) => student.email));
    const items = itemAnalysis(bank, context.attempts.filter((row) => emails.has(row.email)));
    csv = toCsv(items, [
      { header: "Item", value: (row) => row.id },
      { header: "Question", value: (row) => row.question },
      { header: "Correct option", value: (row) => LETTERS[row.correct] },
      { header: "Times drawn", value: (row) => row.drawn },
      { header: "Percent correct", value: (row) => (row.percentCorrect == null ? "" : row.percentCorrect.toFixed(1)) },
      ...[0, 1, 2, 3].map((index) => ({ header: `Chose ${LETTERS[index]}`, value: (row: (typeof items)[number]) => row.optionCounts[index] ?? 0 })),
      { header: "Blank", value: (row) => row.blank },
      { header: "Flag", value: (row) => row.flag ?? "" },
    ]);
    name = `quiz-items-w${week}`;
    rowCount = items.length;
  } else {
    throw new ApiError(400, "Unknown export scope.", "VALIDATION");
  }
  await logAdminEvent(admin, actor, "grades_exported", "quizzes", scope, { rows: rowCount, week: week ?? null });
  return csvResponse(csv, name);
}
