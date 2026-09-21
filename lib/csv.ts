export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(raw: string | number | null | undefined): string {
  let value = raw == null ? "" : String(raw);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replace(/"/g, '""')}"`;
}

/** UTF-8 BOM + CRLF, every field quoted: the format Blackboard's gradebook upload accepts. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
  for (const row of rows) lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export interface GradeExportRow {
  lastName: string;
  firstName: string;
  username: string;
  scores: Record<string, number | null>;
}

export function blackboardColumnName(shortTitle: string, assignmentId: string, pointsPossible: number) {
  return `FordMS ${assignmentId.replace("FORDMS-", "")} ${shortTitle} [Total Pts: ${pointsPossible} Score]`;
}

export function toBlackboardCsv(rows: GradeExportRow[], assignments: { id: string; shortTitle: string; weightPercent: number }[], scale: "rubric" | "course"): string {
  const columns: CsvColumn<GradeExportRow>[] = [
    { header: "Last Name", value: (row) => row.lastName },
    { header: "First Name", value: (row) => row.firstName },
    { header: "Username", value: (row) => row.username },
    ...assignments.map((assignment) => ({
      header: blackboardColumnName(assignment.shortTitle, assignment.id, scale === "rubric" ? 100 : assignment.weightPercent),
      value: (row: GradeExportRow) => {
        const score = row.scores[assignment.id];
        if (score == null) return "";
        return scale === "rubric" ? Number(score).toFixed(2) : ((Number(score) * assignment.weightPercent) / 100).toFixed(2);
      },
    })),
  ];
  return toCsv(rows, columns);
}

export function splitName(name: string | null | undefined, email: string): { firstName: string; lastName: string } {
  const clean = (name ?? "").trim();
  if (!clean) return { firstName: email.split("@")[0], lastName: "" };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}
