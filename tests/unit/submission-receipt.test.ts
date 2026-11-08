import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCourseConfig } from "@/lib/config/defaults";
import { wordCount } from "@/lib/writing";
import { FakeDb } from "./fake-supabase";

const mocks = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), effective: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ requireCourseUser: mocks.user }));
vi.mock("@/lib/server/course-db", () => ({ createCourseAdminClient: mocks.admin }));
vi.mock("@/lib/server/config", () => ({ loadEffectiveAssignments: mocks.effective }));
import { GET } from "@/app/api/course/bootstrap/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ email: "student@fordham.edu", role: "student" });
  const db = new FakeDb();
  db.rows("ehr_assignment_submissions").push(
    { email: "student@fordham.edu", assignment_id: "FORDMS-A2", reflection: "My saved analysis.\n\nMore evidence here.", version: 2, status: "submitted", submitted_at: "2026-11-08T12:00:00Z" },
    { email: "other@fordham.edu", assignment_id: "FORDMS-A2", reflection: "Another student's private analysis", version: 1, status: "submitted" },
  );
  mocks.admin.mockReturnValue(db.client());
  mocks.effective.mockResolvedValue({ config: defaultCourseConfig, assignments: defaultCourseConfig.assignments, releases: [], version: 1 });
});

describe("submission receipt", () => {
  it("returns the current learner's saved text and version after a reload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]).toMatchObject({ reflection: "My saved analysis.\n\nMore evidence here.", version: 2, submitted_at: "2026-11-08T12:00:00Z" });
    expect(JSON.stringify(body)).not.toContain("Another student's");
  });

  it("requires authentication before reading a saved analysis", async () => {
    mocks.user.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await GET()).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("counts words consistently across paragraphs, tabs, and blank submissions", () => {
    expect(wordCount(" \n\t ")).toBe(0);
    expect(wordCount("  First paragraph.\n\nSecond\tparagraph.\u00a0Done. ")).toBe(5);
  });
});
