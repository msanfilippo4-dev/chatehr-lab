import { describe, expect, it } from "vitest";
import { ACTION_IDS, isActionId } from "@/lib/actions";
import { defaultAssignments } from "@/lib/assignments";
import { defaultCourseConfig } from "@/lib/config/defaults";
import { mergeConfig, studentSafeConfig } from "@/lib/config/merge";
import { CourseConfigSchema } from "@/lib/config/schema";

describe("course configuration", () => {
  it("default configuration validates", () => {
    const parsed = CourseConfigSchema.safeParse(defaultCourseConfig);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues.slice(0, 3))).toBe(true);
  });

  it("every assignment requirement uses a known action and rubrics total 100", () => {
    for (const assignment of defaultAssignments) {
      for (const requirement of assignment.requirements) expect(isActionId(requirement.action), requirement.action).toBe(true);
      expect(assignment.rubric.reduce((sum, item) => sum + item.points, 0)).toBe(100);
      expect(new Date(assignment.dueAt).getTime()).toBeGreaterThan(0);
    }
    expect(new Set(ACTION_IDS).size).toBe(ACTION_IDS.length);
  });

  it("assignment shares total 18 percent and due dates are Sundays in New York", () => {
    expect(defaultAssignments.reduce((sum, item) => sum + item.weightPercent, 0)).toBe(18);
    for (const assignment of defaultAssignments) {
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(assignment.dueAt));
      expect(weekday, assignment.id).toBe("Sun");
    }
    expect(defaultAssignments[1].dueAt.startsWith("2026-11-01")).toBe(true);
  });

  it("merge keeps defaults for invalid sections and applies valid ones", () => {
    const merged = mergeConfig(defaultCourseConfig, { icd10Catalog: "nonsense", visitTypes: [{ id: "VT-X", label: "Custom", durationMinutes: 45, resources: [] }] });
    expect(merged.invalidSections.map((item) => item.section)).toEqual(["icd10Catalog"]);
    expect(merged.config.icd10Catalog).toEqual(defaultCourseConfig.icd10Catalog);
    expect(merged.config.visitTypes[0].id).toBe("VT-X");
  });

  it("rejects alert rules with invalid regular expressions", () => {
    const bad = { ...defaultCourseConfig, alertRules: [{ ...defaultCourseConfig.alertRules[0], orderPattern: "(" }] };
    expect(CourseConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("hides hidden assignments from students", () => {
    const config = { ...defaultCourseConfig, assignments: defaultCourseConfig.assignments.map((item, index) => ({ ...item, releaseState: index === 3 ? ("hidden" as const) : item.releaseState })) };
    expect(studentSafeConfig(config).assignments.map((item) => item.id)).toEqual(["FORDMS-A1", "FORDMS-A2", "FORDMS-A3"]);
  });
});
