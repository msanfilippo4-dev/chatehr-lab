import { describe, expect, it } from "vitest";
import { buildProviders, testAuthEnabled } from "@/lib/auth";
import { splitName, toBlackboardCsv, toCsv } from "@/lib/csv";
import { GradeBodySchema, SubmitBodySchema, SyncBodySchema } from "@/lib/schemas/api";

describe("Blackboard CSV export", () => {
  const assignments = [{ id: "FORDMS-A1", shortTitle: "Identity and access", weightPercent: 2 }, { id: "FORDMS-A2", shortTitle: "Clinical loop closure", weightPercent: 3 }];
  it("produces a BOM, CRLF, quoted header, and score columns", () => {
    const csv = toBlackboardCsv([{ lastName: "Reed", firstName: "Marcus", username: "mreed3", scores: { "FORDMS-A1": 88, "FORDMS-A2": null } }], assignments, "rubric");
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.split("\r\n");
    expect(lines[0].replace(/^\uFEFF/, "")).toBe('"Last Name","First Name","Username","FordMS A1 Identity and access [Total Pts: 100 Score]","FordMS A2 Clinical loop closure [Total Pts: 100 Score]"');
    expect(lines[1]).toBe('"Reed","Marcus","mreed3","88.00",""');
  });
  it("scales to course percentage", () => {
    const csv = toBlackboardCsv([{ lastName: "R", firstName: "M", username: "m", scores: { "FORDMS-A1": 50, "FORDMS-A2": 100 } }], assignments, "course");
    expect(csv).toContain("[Total Pts: 2 Score]");
    expect(csv.split("\r\n")[1]).toBe('"R","M","m","1.00","3.00"');
  });
  it("neutralizes formula injection", () => {
    const csv = toCsv([{ v: "=HYPERLINK(\"x\")" }], [{ header: "v", value: (row) => row.v }]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
  it("splits names sensibly", () => {
    expect(splitName("Liu Huang", "x@fordham.edu")).toEqual({ firstName: "Liu", lastName: "Huang" });
    expect(splitName("", "abc@fordham.edu")).toEqual({ firstName: "abc", lastName: "" });
  });
});

describe("test authentication guard", () => {
  it("is disabled unless FORDMS_TEST_AUTH=1", () => {
    expect(testAuthEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(buildProviders({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" } as unknown as NodeJS.ProcessEnv).length).toBe(1);
  });
  it("adds the test provider only with the flag", () => {
    expect(buildProviders({ FORDMS_TEST_AUTH: "1" } as unknown as NodeJS.ProcessEnv).length).toBe(2);
  });
  it("throws on a production Vercel deployment", () => {
    expect(() => testAuthEnabled({ FORDMS_TEST_AUTH: "1", VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toThrow();
  });
});

describe("API schemas", () => {
  it("rejects short reflections and unknown assignment ids", () => {
    expect(SubmitBodySchema.safeParse({ assignmentId: "FORDMS-A1", reflection: "short" }).success).toBe(false);
    expect(SubmitBodySchema.safeParse({ assignmentId: "X", reflection: "a".repeat(200) }).success).toBe(false);
    expect(SubmitBodySchema.safeParse({ assignmentId: "FORDMS-A1", reflection: "a".repeat(200) }).success).toBe(true);
  });
  it("requires a workspace envelope with patients and audit", () => {
    expect(SyncBodySchema.safeParse({ workspace: { version: 3, patients: [], audit: [] } }).success).toBe(false);
    expect(SyncBodySchema.safeParse({ workspace: { version: 3, patients: [{}], audit: [{ id: "a", timestamp: "2026-10-01T00:00:00Z", action: "Open chart" }] } }).success).toBe(true);
  });
  it("grade body needs feedback and valid rubric entries", () => {
    expect(GradeBodySchema.safeParse({ email: "a@fordham.edu", assignmentId: "FORDMS-A1", feedback: "too short?", rubric: [] }).success).toBe(true);
    expect(GradeBodySchema.safeParse({ email: "a@fordham.edu", assignmentId: "FORDMS-A1", feedback: "x", rubric: [] }).success).toBe(false);
    expect(GradeBodySchema.safeParse({ email: "a@fordham.edu", assignmentId: "FORDMS-A1", feedback: "Good work overall", rubric: [{ criterionIndex: 0, pointsAwarded: 250 }] }).success).toBe(false);
  });
});
