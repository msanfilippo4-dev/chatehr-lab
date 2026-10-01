import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminClient } from "@/lib/server/course-db";

const mocks = vi.hoisted(() => ({ instructor: vi.fn(), upload: vi.fn(), download: vi.fn(), info: vi.fn(), list: vi.fn(), sign: vi.fn(), audit: vi.fn(), rate: vi.fn() }));
const admin = { storage: { from: () => ({ upload: mocks.upload, download: mocks.download, info: mocks.info, list: mocks.list, createSignedUploadUrl: mocks.sign }) } } as unknown as AdminClient;
vi.mock("@/lib/server/course-db", () => ({ createCourseAdminClient: () => admin, logAdminEvent: mocks.audit }));
vi.mock("@/lib/server/session", () => ({ requireInstructor: mocks.instructor }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("@/lib/server/ehrgo", () => ({ EHRGO_BUCKET: "private-materials", EHRGO_ACTIVITIES: [{ id: "74" }] }));

import { POST as startUpload } from "@/app/api/ehrgo/uploads/route";
import { POST as finishUpload } from "@/app/api/ehrgo/uploads/complete/route";
import { completeEhrgoUpload, EhrgoUploadSchema, findUploadedEhrgoDownload, listUploadedEhrgoMaterials, prepareEhrgoUpload, requireSameOrigin } from "@/lib/server/ehrgo-uploads";

const actor = "teacher@fordham.edu";
const id = "e10f2925-5adb-46a7-9bdf-0b23da5c5f91";
const prefix = "fall-2026/ehrgo/uploads";
const records = new Map<string, string>();
const input = { activityId: "74", name: "Worksheet.pdf", bytes: 3, audience: "student" as const };
function pending(overrides: Record<string, unknown> = {}) {
  return { ...input, id, contentType: "application/pdf", storagePath: `${prefix}/${id}.pdf`, uploadedBy: actor, createdAt: new Date().toISOString(), readyAt: null, ...overrides };
}
function store(record: ReturnType<typeof pending>, ready = false) {
  records.set(`${prefix}/records/${ready ? `ready/${record.audience}` : "pending"}/${id}.json`, JSON.stringify(record));
}
function request(path: string, body: unknown, origin = "https://fordms.com") {
  return new Request(`https://fordms.com${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks(); records.clear();
  mocks.instructor.mockResolvedValue({ email: actor, role: "instructor" });
  mocks.upload.mockImplementation(async (path: string, data: string) => { records.set(path, data); return { data: { path }, error: null }; });
  mocks.download.mockImplementation(async (path: string) => records.has(path) ? { data: new Blob([records.get(path)!]), error: null } : { data: null, error: { statusCode: "404" } });
  mocks.list.mockImplementation(async (path: string, options: { offset: number; limit: number }) => ({ data: [...records.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => ({ name: key.slice(path.length + 1) })).slice(options.offset, options.offset + options.limit), error: null }));
  mocks.info.mockResolvedValue({ data: { size: 3, contentType: "application/pdf" }, error: null });
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/scoped-upload" }, error: null });
});

describe("EHR Go instructor uploads", () => {
  it.each([["UNAUTHORIZED", 401], ["FORBIDDEN", 403], ["DROPPED", 403]])("blocks %s before preparing or publishing", async (error, status) => {
    mocks.instructor.mockRejectedValue(new Error(error as string));
    expect((await startUpload(request("/api/ehrgo/uploads", input))).status).toBe(status);
    expect((await finishUpload(request("/api/ehrgo/uploads/complete", { id }))).status).toBe(status);
    expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects cross-site upload requests", async () => {
    expect((await startUpload(request("/api/ehrgo/uploads", input, "https://elsewhere.example"))).status).toBe(403);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("accepts the browser's public origin when Next uses an internal proxy URL", () => {
    const proxied = new Request("http://localhost:3193/api/ehrgo/uploads", { headers: { Host: "fordms.com", Origin: "https://fordms.com", "x-forwarded-proto": "https" } });
    expect(() => requireSameOrigin(proxied)).not.toThrow();
  });
  it.each([{ name: "../key.pdf" }, { name: "bad\nname.pdf" }, { name: "script.html" }, { bytes: 0 }, { bytes: 52428801 }, { activityId: "unknown" }, { storagePath: "keys.zip" }])("validates upload metadata before issuing a token: %j", async (patch) => {
    expect((await startUpload(request("/api/ehrgo/uploads", { ...input, ...patch }))).status).toBe(400);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("defaults to faculty access and binds a non-overwritable token to a generated path", async () => {
    const body = EhrgoUploadSchema.parse({ activityId: "74", name: "Faculty.pdf", bytes: 3 });
    const result = await prepareEhrgoUpload(admin, actor, body);
    expect(body.audience).toBe("instructor");
    expect(mocks.sign).toHaveBeenCalledWith(`${prefix}/${result.id}.pdf`, { upsert: false });
    const saved = JSON.parse(records.get(`${prefix}/records/pending/${result.id}.json`)!);
    expect(saved).toMatchObject({ audience: "instructor", uploadedBy: actor, readyAt: null });
    expect(await listUploadedEhrgoMaterials(true, admin)).toEqual([]);
  });
  it("does not publish an incomplete transfer", async () => {
    store(pending()); mocks.info.mockResolvedValue({ data: null, error: { statusCode: "404" } });
    await expect(completeEhrgoUpload(admin, actor, id)).rejects.toMatchObject({ status: 409 });
    expect(await listUploadedEhrgoMaterials(true, admin)).toEqual([]);
  });
  it.each([{ size: 4, contentType: "application/pdf" }, { size: 3, contentType: "text/html" }])("checks the actual received file before publishing: %j", async (info) => {
    store(pending()); mocks.info.mockResolvedValue({ data: info, error: null });
    await expect(completeEhrgoUpload(admin, actor, id)).rejects.toMatchObject({ status: 409 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not let another instructor publish someone else's upload", async () => {
    store(pending());
    await expect(completeEhrgoUpload(admin, "another@fordham.edu", id)).rejects.toMatchObject({ status: 404 });
    expect(mocks.info).not.toHaveBeenCalled();
  });
  it("expires unfinished upload records", async () => {
    store(pending({ createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }));
    await expect(completeEhrgoUpload(admin, actor, id)).rejects.toMatchObject({ status: 410 });
  });
  it("publishes only a verified transfer and makes confirmation retries idempotent", async () => {
    store(pending());
    const result = await completeEhrgoUpload(admin, actor, id);
    expect(result).toMatchObject({ id: `upload-${id}`, audience: "student", name: input.name });
    expect(await completeEhrgoUpload(admin, actor, id)).toEqual(result);
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect((await findUploadedEhrgoDownload(`upload-${id}`, admin))?.storagePath).toBe(`${prefix}/${id}.pdf`);
  });
  it("never reads faculty upload records when listing materials for students", async () => {
    store(pending({ audience: "instructor", readyAt: new Date().toISOString() }), true);
    expect(await listUploadedEhrgoMaterials(false, admin)).toEqual([]);
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.list.mock.calls[0][0]).toBe(`${prefix}/records/ready/student`);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(await listUploadedEhrgoMaterials(true, admin)).toHaveLength(1);
  });
  it("rejects tampered catalog paths and malformed download IDs", async () => {
    store(pending({ storagePath: "original-faculty-key.docx", readyAt: new Date().toISOString() }), true);
    await expect(findUploadedEhrgoDownload(`upload-${id}`, admin)).rejects.toMatchObject({ status: 503 });
    mocks.download.mockClear();
    expect(await findUploadedEhrgoDownload("upload-../../keys", admin)).toBeUndefined();
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
