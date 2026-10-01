import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ courseUser: vi.fn(), instructor: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ requireCourseUser: mocks.courseUser, requireInstructor: mocks.instructor }));
vi.mock("@/lib/server/course-db", () => ({ createCourseAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.sign }) } }) }));
vi.mock("@/lib/server/ehrgo", () => ({
  EHRGO_BUCKET: "private-course-materials",
  findEhrgoDownload: (id: string) => ({
    worksheet: { audience: "student", storagePath: "worksheet.docx", name: "Worksheet.docx" },
    key: { audience: "instructor", storagePath: "key.docx", name: "Faculty KEY.docx" },
    "faculty-package": { audience: "instructor", storagePath: "keys.zip", name: "Faculty_Keys.zip" },
  })[id],
}));
import { GET } from "@/app/api/ehrgo/downloads/[id]/route";

const download = (id: string) => GET(new Request(`https://fordms.com/api/ehrgo/downloads/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.courseUser.mockResolvedValue({ email: "learner@fordham.edu", role: "student" });
  mocks.instructor.mockRejectedValue(new Error("FORBIDDEN"));
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/short-lived-download" }, error: null });
});

describe("EHR Go download authorization", () => {
  it("requires sign-in before looking up or signing a file", async () => {
    mocks.courseUser.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await download("worksheet")).status).toBe(401);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("rejects dropped enrollment", async () => {
    mocks.courseUser.mockRejectedValue(new Error("DROPPED"));
    expect((await download("worksheet")).status).toBe(403);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it.each(["key", "faculty-package"])("blocks student access to %s, including a direct URL", async (id) => {
    expect((await download(id)).status).toBe(403);
    expect(mocks.instructor).toHaveBeenCalledOnce();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("serves student materials through a non-cached 60-second storage redirect", async () => {
    const response = await download("worksheet");
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.sign).toHaveBeenCalledWith("worksheet.docx", 60, { download: "Worksheet.docx" });
    expect(mocks.instructor).not.toHaveBeenCalled();
  });
  it("checks the live instructor role before signing faculty downloads", async () => {
    mocks.instructor.mockResolvedValue({ email: "instructor@fordham.edu", role: "instructor" });
    expect((await download("key")).status).toBe(303);
    expect(mocks.sign).toHaveBeenCalledWith("key.docx", 60, { download: "Faculty KEY.docx" });
  });
  it("does not construct storage paths from an unknown download ID", async () => {
    expect((await download("../key.docx")).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("reports storage failures without exposing a URL", async () => {
    mocks.sign.mockResolvedValue({ data: null, error: { message: "private failure" } });
    const response = await download("worksheet");
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("private failure");
  });
});
