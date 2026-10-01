import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { EHRGO_FILE_TYPES, EHRGO_MAX_UPLOAD_BYTES, type EhrgoSubmission } from "@/lib/ehrgo-materials";
import { createCourseAdminClient, logAdminEvent, type AdminClient } from "./course-db";
import type { CourseUserContext } from "./session";
import { EHRGO_ACTIVITIES, EHRGO_BUCKET } from "./ehrgo";
import { ApiError } from "./errors";

export const EHRGO_SUBMISSION_PREFIX = "fall-2026/ehrgo/submissions";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = /^[0-9a-f]{64}$/;
const LIFETIME_MS = 2 * 60 * 60 * 1000;

export const EhrgoSubmissionSchema = z.object({
  activityId: z.string().refine((id) => EHRGO_ACTIVITIES.some((activity) => activity.id === id && activity.category === "assigned"), "Choose an assigned EHR Go activity."),
  name: z.string().trim().min(1).max(180).refine((name) => !/[\/\\\x00-\x1f\x7f]/.test(name), "Use a filename without path separators or control characters.")
    .refine((name) => Object.hasOwn(EHRGO_FILE_TYPES, name.split(".").pop()?.toLowerCase() ?? ""), "Choose a PDF, Office document, CSV, text file, ZIP, or image."),
  bytes: z.number().int().positive().max(EHRGO_MAX_UPLOAD_BYTES, "Files must be 50 MB or smaller."),
}).strict();

const RecordSchema = EhrgoSubmissionSchema.extend({
  id: z.string().uuid(), email: z.string().email().endsWith("@fordham.edu"),
  studentName: z.string().max(180).nullable(), contentType: z.string(), storagePath: z.string(),
  createdAt: z.string().datetime(), submittedAt: z.string().datetime().nullable(),
});
type SubmissionRecord = z.infer<typeof RecordSchema>;
const ownerFolder = (email: string) => createHash("sha256").update(email).digest("hex");
const pendingPath = (id: string) => `${EHRGO_SUBMISSION_PREFIX}/pending/${id}.json`;
const readyPath = (email: string, id: string) => `${EHRGO_SUBMISSION_PREFIX}/ready/${ownerFolder(email)}/${id}.json`;
const faculty = (user: CourseUserContext) => user.role === "instructor" || user.role === "admin";
const summary = (record: SubmissionRecord): EhrgoSubmission => ({ id: record.id, activityId: record.activityId, name: record.name, bytes: record.bytes, email: record.email, studentName: record.studentName, submittedAt: record.submittedAt! });
const unavailable = () => new ApiError(503, "Answer-sheet submissions are temporarily unavailable. Please try again or email your instructor with the file attached.", "SUBMISSION_UNAVAILABLE");

async function readRecord(admin: AdminClient, path: string, id: string): Promise<SubmissionRecord | null> {
  const { data, error } = await admin.storage.from(EHRGO_BUCKET).download(path);
  if (error) {
    if ("statusCode" in error && [400, 404].includes(Number(error.statusCode))) return null;
    throw unavailable();
  }
  if (!data || data.size > 4096) throw unavailable();
  let value: unknown;
  try { value = JSON.parse(await data.text()); } catch { throw unavailable(); }
  const parsed = RecordSchema.safeParse(value);
  if (!parsed.success) throw unavailable();
  const record = parsed.data;
  const extension = record.name.split(".").pop()!.toLowerCase();
  if (record.id !== id || record.contentType !== EHRGO_FILE_TYPES[extension] || record.storagePath !== `${EHRGO_SUBMISSION_PREFIX}/files/${id}.${extension}`) throw unavailable();
  return record;
}

async function readyRecord(admin: AdminClient, email: string, id: string) {
  const record = await readRecord(admin, readyPath(email, id), id);
  if (record && record.email !== email) throw unavailable();
  return record?.submittedAt ? record : null;
}

async function listFolder(admin: AdminClient, prefix: string) {
  const files: { name: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(EHRGO_BUCKET).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !data) throw unavailable();
    files.push(...data);
    if (data.length < 100) return files;
  }
}

export async function listEhrgoSubmissions(user: CourseUserContext, admin = createCourseAdminClient()): Promise<EhrgoSubmission[]> {
  const root = `${EHRGO_SUBMISSION_PREFIX}/ready`;
  const owners = faculty(user) ? (await listFolder(admin, root)).filter((file) => OWNER.test(file.name)).map((file) => file.name) : [ownerFolder(user.email)];
  const records: SubmissionRecord[] = [];
  for (const owner of owners) {
    const prefix = `${root}/${owner}`;
    const ids = (await listFolder(admin, prefix)).filter((file) => file.name.endsWith(".json") && UUID.test(file.name.slice(0, -5))).map((file) => file.name.slice(0, -5));
    for (let start = 0; start < ids.length; start += 10) {
      const batch = await Promise.all(ids.slice(start, start + 10).map((id) => readRecord(admin, `${prefix}/${id}.json`, id)));
      for (const record of batch) {
        if (!record?.submittedAt) continue;
        if (ownerFolder(record.email) !== owner || (!faculty(user) && record.email !== user.email)) throw unavailable();
        records.push(record);
      }
    }
  }
  return records.sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!)).map(summary);
}

export async function prepareEhrgoSubmission(admin: AdminClient, user: CourseUserContext, input: z.infer<typeof EhrgoSubmissionSchema>) {
  const id = randomUUID();
  const extension = input.name.split(".").pop()!.toLowerCase();
  const contentType = EHRGO_FILE_TYPES[extension];
  const storagePath = `${EHRGO_SUBMISSION_PREFIX}/files/${id}.${extension}`;
  const record: SubmissionRecord = { ...input, id, email: user.email, studentName: user.name?.slice(0, 180) ?? null, contentType, storagePath, createdAt: new Date().toISOString(), submittedAt: null };
  const stored = await admin.storage.from(EHRGO_BUCKET).upload(pendingPath(id), JSON.stringify(record), { contentType: "application/json", cacheControl: "0", upsert: false });
  if (stored.error) throw unavailable();
  const { data, error } = await admin.storage.from(EHRGO_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) throw unavailable();
  return { id, signedUrl: data.signedUrl, contentType };
}

export async function completeEhrgoSubmission(admin: AdminClient, user: CourseUserContext, id: string): Promise<EhrgoSubmission> {
  const record = await readRecord(admin, pendingPath(id), id);
  if (!record || record.email !== user.email) throw new ApiError(404, "This answer-sheet upload was not found.", "NOT_FOUND");
  const ready = await readyRecord(admin, user.email, id);
  if (ready) return summary(ready);
  if (Date.now() - new Date(record.createdAt).getTime() > LIFETIME_MS) throw new ApiError(410, "This upload expired. Choose your answer sheet and start again.", "UPLOAD_EXPIRED");
  const info = await admin.storage.from(EHRGO_BUCKET).info(record.storagePath);
  if (info.error || !info.data) throw new ApiError(409, "The file has not finished uploading. Try confirming it again.", "UPLOAD_INCOMPLETE");
  if (info.data.size !== record.bytes || info.data.size > EHRGO_MAX_UPLOAD_BYTES || info.data.contentType?.split(";")[0] !== record.contentType) throw new ApiError(409, "The received file does not match this upload. Choose your answer sheet and start again.", "UPLOAD_MISMATCH");
  const completed = { ...record, submittedAt: new Date().toISOString() };
  const saved = await admin.storage.from(EHRGO_BUCKET).upload(readyPath(user.email, id), JSON.stringify(completed), { contentType: "application/json", cacheControl: "0", upsert: false });
  if (saved.error) {
    const concurrent = await readyRecord(admin, user.email, id);
    if (concurrent) return summary(concurrent);
    throw unavailable();
  }
  await logAdminEvent(admin, user.email, "ehrgo.answer_sheet_submitted", "ehrgo_submission", id, { activityId: record.activityId, filename: record.name, bytes: record.bytes });
  return summary(completed);
}

export async function findEhrgoSubmission(admin: AdminClient, user: CourseUserContext, id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "This answer sheet was not found.", "NOT_FOUND");
  const pending = await readRecord(admin, pendingPath(id), id);
  if (!pending) throw new ApiError(404, "This answer sheet was not found.", "NOT_FOUND");
  if (pending.email !== user.email && !faculty(user)) throw new ApiError(403, "You can only download your own answer sheets.", "FORBIDDEN");
  const ready = await readyRecord(admin, pending.email, id);
  if (!ready) throw new ApiError(404, "This answer sheet has not been submitted.", "NOT_FOUND");
  return ready;
}
