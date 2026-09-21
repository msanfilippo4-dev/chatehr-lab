import type { CourseAssignment } from "../config/types";
import type { AdminClient, CourseUserRow } from "./course-db";

export type RosterStatus = "not_started" | "in_progress" | "ready" | "submitted" | "revision_requested" | "graded";

export interface RosterCell {
  assignment_id: string;
  status: RosterStatus;
  percent: number;
  earned_units: number;
  imported_units: number;
  total_units: number;
  score: number | null;
  version: number | null;
  late: boolean;
  submitted_at: string | null;
  graded_at: string | null;
  updated_at: string | null;
}

export interface RosterRow extends Omit<CourseUserRow, "image"> {
  cells: RosterCell[];
}

export async function loadRoster(admin: AdminClient, assignments: CourseAssignment[], options: { includeTest?: boolean; includeStaff?: boolean } = {}): Promise<RosterRow[]> {
  const [users, progress, submissions] = await Promise.all([
    admin.from("ehr_course_users").select("email,name,role,enrollment_status,first_name,last_name,blackboard_username,section,notes,created_at,last_login_at").order("last_name", { nullsFirst: false }).order("name"),
    admin.from("ehr_assignment_progress").select("email,assignment_id,percent_complete,status,earned_units,imported_units,total_units,updated_at"),
    admin.from("ehr_assignment_submissions").select("email,assignment_id,status,version,score,late,submitted_at,graded_at"),
  ]);
  for (const result of [users, progress, submissions]) if (result.error) throw result.error;
  const rows = (users.data ?? []) as CourseUserRow[];
  return rows
    .filter((user) => options.includeStaff || user.role === "student")
    .filter((user) => options.includeTest || user.enrollment_status !== "test")
    .map((user) => ({
      ...user,
      cells: assignments.map((assignment) => {
        const p = (progress.data ?? []).find((row) => row.email === user.email && row.assignment_id === assignment.id);
        const s = (submissions.data ?? []).find((row) => row.email === user.email && row.assignment_id === assignment.id);
        const status: RosterStatus = s ? (s.status === "graded" ? "graded" : s.status === "revision_requested" ? "revision_requested" : "submitted") : ((p?.status as RosterStatus | undefined) ?? "not_started");
        return {
          assignment_id: assignment.id,
          status,
          percent: p?.percent_complete ?? 0,
          earned_units: p?.earned_units ?? 0,
          imported_units: p?.imported_units ?? 0,
          total_units: p?.total_units ?? assignment.requirements.reduce((sum, item) => sum + item.minimumCount, 0),
          score: s?.score == null ? null : Number(s.score),
          version: s?.version ?? null,
          late: Boolean(s?.late),
          submitted_at: s?.submitted_at ?? null,
          graded_at: s?.graded_at ?? null,
          updated_at: p?.updated_at ?? null,
        };
      }),
    }));
}
