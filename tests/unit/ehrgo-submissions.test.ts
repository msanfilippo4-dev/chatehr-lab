import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { AdminClient } from "@/lib/server/course-db";

const mocks = vi.hoisted(() => ({ user: vi.fn(), upload: vi.fn(), download: vi.fn(), info: vi.fn(), list: vi.fn(), signUpload: vi.fn(), signDownload: vi.fn(), audit: vi.fn(), rate: vi.fn() }));
const admin = { storage: { from: () => ({ upload: mocks.upload, download: mocks.download, info: mocks.info, list: mocks.list, createSignedUploadUrl: mocks.signUpload, createSignedUrl: mocks.signDownload }) } } as unknown as AdminClient;
vi.mock("@/lib/server/course-db", () => ({ createCourseAdminClient: () => admin, logAdminEvent: mocks.audit }));
vi.mock("@/lib/server/session", () => ({ requireCourseUser: mocks.user }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("@/lib/server/ehrgo", () => ({ EHRGO_BUCKET: "private-materials", EHRGO_ACTIVITIES: [{ id: "74", category: "assigned" }, { id: "9114", category: "practice" }] }));

import { POST as start } from "@/app/api/ehrgo/submissions/route";
import { POST as finish } from "@/app/api/ehrgo/submissions/complete/route";
import { GET as download } from "@/app/api/ehrgo/submissions/[id]/route";
import { completeEhrgoSubmission, findEhrgoSubmission, listEhrgoSubmissions, prepareEhrgoSubmission } from "@/lib/server/ehrgo-submissions";

const user = { email: "learner@fordham.edu", name: "Course Learner", role: "student" as const };
const teacher = { email: "teacher@fordham.edu", name: "Teacher", role: "instructor" as const };
const id = "e10f2925-5adb-46a7-9bdf-0b23da5c5f91";
const prefix = "fall-2026/ehrgo/submissions";
const records = new Map<string, string>();
const input = { activityId: "74", name: "Answers.pdf", bytes: 3 };
const owner = (email: string) => createHash("sha256").update(email).digest("hex");
const readyPath = (email: string) => `${prefix}/ready/${owner(email)}/${id}.json`;
function record(overrides: Record<string, unknown> = {}) {
  return { ...input, id, email: user.email, studentName: user.name, contentType: "application/pdf", storagePath: `${prefix}/files/${id}.pdf`, createdAt: new Date().toISOString(), submittedAt: null, ...overrides };
}
function store(overrides: Record<string, unknown> = {}, ready = false) {
  const value = record(overrides);
  records.set(`${prefix}/pending/${id}.json`, JSON.stringify(value));
  if (ready) records.set(readyPath(String(value.email)), JSON.stringify(value));
}
function request(path: string, body: unknown, origin = "https://fordms.com") {
  return new Request(`https://fordms.com${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
const get = (value = id) => download(new Request(`https://fordms.com/api/ehrgo/submissions/${value}`), { params: Promise.resolve({ id: value }) });

beforeEach(() => {
  vi.resetAllMocks(); records.clear();
  mocks.user.mockResolvedValue(user);
  mocks.upload.mockImplementation(async (path: string, value: string) => { records.set(path, value); return { data: { path }, error: null }; });
  mocks.download.mockImplementation(async (path: string) => records.has(path) ? { data: new Blob([records.get(path)!]), error: null } : { data: null, error: { statusCode: "404" } });
  mocks.list.mockImplementation(async (path: string, options: { offset: number; limit: number }) => ({ data: [...new Set([...records.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => key.slice(path.length + 1).split("/")[0]))].map((name) => ({ name })).slice(options.offset, options.offset + options.limit), error: null }));
  mocks.info.mockResolvedValue({ data: { size: 3, contentType: "application/pdf" }, error: null });
  mocks.signUpload.mockResolvedValue({ data: { signedUrl: "https://storage.example/scoped-upload" }, error: null });
  mocks.signDownload.mockResolvedValue({ data: { signedUrl: "https://storage.example/private-download" }, error: null });
});

describe("EHR Go answer-sheet submissions", () => {
  it.each([["UNAUTHORIZED", 401], ["DROPPED", 403]])("blocks %s for preparing, confirming, and downloading", async (error, status) => {
    mocks.user.mockRejectedValue(new Error(error as string));
    expect((await start(request("/api/ehrgo/submissions", input))).status).toBe(status);
    expect((await finish(request("/api/ehrgo/submissions/complete", { id }))).status).toBe(status);
    expect((await get()).status).toBe(status);
    expect(mocks.signUpload).not.toHaveBeenCalled(); expect(mocks.signDownload).not.toHaveBeenCalled();
  });
  it("rejects cross-site submission requests", async () => {
    expect((await start(request("/api/ehrgo/submissions", input, "https://elsewhere.example"))).status).toBe(403);
    expect((await finish(request("/api/ehrgo/submissions/complete", { id }, "https://elsewhere.example"))).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each([{ email: teacher.email }, { audience: "student" }, { storagePath: "faculty-key.docx" }, { name: "../answers.pdf" }, { name: "answers.html" }, { bytes: 0 }, { bytes: 52428801 }, { activityId: "9114" }])("rejects invalid or impersonating metadata: %j", async (patch) => {
    expect((await start(request("/api/ehrgo/submissions", { ...input, ...patch }))).status).toBe(400);
    expect(mocks.signUpload).not.toHaveBeenCalled();
  });
  it("binds the private upload to the signed-in student's identity and a generated path", async () => {
    const prepared = await prepareEhrgoSubmission(admin, user, input);
    const saved = JSON.parse(records.get(`${prefix}/pending/${prepared.id}.json`)!);
    expect(saved).toMatchObject({ email: user.email, studentName: user.name, submittedAt: null });
    expect(mocks.signUpload).toHaveBeenCalledWith(`${prefix}/files/${prepared.id}.pdf`, { upsert: false });
    expect(await listEhrgoSubmissions(user, admin)).toEqual([]);
  });
  it("does not allow another student or an instructor to confirm someone else's upload", async () => {
    store();
    for (const actor of [{ ...user, email: "another@fordham.edu" }, teacher]) {
      await expect(completeEhrgoSubmission(admin, actor, id)).rejects.toMatchObject({ status: 404 });
    }
    expect(mocks.info).not.toHaveBeenCalled();
  });
  it.each([null, { size: 4, contentType: "application/pdf" }, { size: 3, contentType: "text/html" }])("does not accept an incomplete or mismatched transfer: %j", async (data) => {
    store(); mocks.info.mockResolvedValue({ data, error: data ? null : { statusCode: "404" } });
    await expect(completeEhrgoSubmission(admin, user, id)).rejects.toMatchObject({ status: 409 });
    expect(await listEhrgoSubmissions(user, admin)).toEqual([]);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("expires unfinished submissions", async () => {
    store({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });
    await expect(completeEhrgoSubmission(admin, user, id)).rejects.toMatchObject({ status: 410 });
  });
  it("records a timestamped receipt only after verifying the file and safely retries confirmation", async () => {
    store();
    const receipt = await completeEhrgoSubmission(admin, user, id);
    expect(receipt).toMatchObject({ id, email: user.email, name: input.name });
    expect(Number.isFinite(Date.parse(receipt.submittedAt))).toBe(true);
    expect(await completeEhrgoSubmission(admin, user, id)).toEqual(receipt);
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(await listEhrgoSubmissions(user, admin)).toEqual([receipt]);
  });
  it("isolates student lists and lets faculty review all completed submissions", async () => {
    store({ submittedAt: new Date().toISOString() }, true);
    const another = { ...user, email: "another@fordham.edu" };
    expect(await listEhrgoSubmissions(another, admin)).toEqual([]);
    expect(mocks.list.mock.calls[0][0]).toBe(`${prefix}/ready/${owner(another.email)}`);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(await listEhrgoSubmissions(teacher, admin)).toHaveLength(1);
  });
  it("blocks another student's direct download without issuing a storage URL", async () => {
    store({ submittedAt: new Date().toISOString() }, true);
    mocks.user.mockResolvedValue({ ...user, email: "another@fordham.edu" });
    expect((await get()).status).toBe(403);
    expect(mocks.signDownload).not.toHaveBeenCalled();
  });
  it.each([user, teacher, { ...teacher, role: "admin" }])("allows the owner and faculty to download confirmed files: $role", async (actor) => {
    store({ submittedAt: new Date().toISOString() }, true);
    mocks.user.mockResolvedValue(actor);
    const response = await get();
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.signDownload).toHaveBeenCalledWith(`${prefix}/files/${id}.pdf`, 60, { download: input.name });
  });
  it("does not expose unfinished or tampered files", async () => {
    store();
    expect((await get()).status).toBe(404);
    expect((await get("../faculty-key")).status).toBe(404);
    store({ storagePath: "original-faculty-key.docx", submittedAt: new Date().toISOString() }, true);
    await expect(findEhrgoSubmission(admin, user, id)).rejects.toMatchObject({ status: 503 });
    expect(mocks.signDownload).not.toHaveBeenCalled();
  });
});
