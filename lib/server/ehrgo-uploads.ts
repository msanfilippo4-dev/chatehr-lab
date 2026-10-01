import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EHRGO_FILE_TYPES, EHRGO_MAX_UPLOAD_BYTES, type UploadedEhrgoMaterial } from "@/lib/ehrgo-materials";
import { createCourseAdminClient, logAdminEvent, type AdminClient } from "./course-db";
import { EHRGO_ACTIVITIES, EHRGO_BUCKET, type EhrgoDownload } from "./ehrgo";
import { ApiError } from "./errors";

export const EHRGO_UPLOAD_PREFIX = "fall-2026/ehrgo/uploads";
const RECORD_PREFIX = `${EHRGO_UPLOAD_PREFIX}/records`;
const UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EhrgoUploadSchema = z.object({
  activityId: z.string().refine((id) => EHRGO_ACTIVITIES.some((activity) => activity.id === id), "Choose an EHR Go activity."),
  name: z.string().trim().min(1).max(180).refine((name) => !/[\/\\\x00-\x1f\x7f]/.test(name), "Use a filename without path separators or control characters.")
    .refine((name) => Object.hasOwn(EHRGO_FILE_TYPES, name.split(".").pop()?.toLowerCase() ?? ""), "Choose a PDF, Office document, CSV, text file, ZIP, or image."),
  audience: z.enum(["student", "instructor"]).default("instructor"),
  bytes: z.number().int().positive().max(EHRGO_MAX_UPLOAD_BYTES, "Files must be 50 MB or smaller."),
}).strict();

export const EhrgoCompleteSchema = z.object({ id: z.string().uuid() }).strict();

const RecordSchema = EhrgoUploadSchema.extend({
  id: z.string().uuid(), contentType: z.string(), storagePath: z.string(),
  uploadedBy: z.string().email().endsWith("@fordham.edu"),
  createdAt: z.string().datetime(), readyAt: z.string().datetime().nullable(),
});
type MaterialRecord = z.infer<typeof RecordSchema>;

function summary(record: MaterialRecord): UploadedEhrgoMaterial {
  return { id: `upload-${record.id}`, activityId: record.activityId, name: record.name, audience: record.audience, bytes: record.bytes, uploadedAt: record.readyAt ?? record.createdAt };
}

function unavailable() { return new ApiError(503, "Course uploads are temporarily unavailable. Please try again.", "UPLOAD_UNAVAILABLE"); }

async function readRecord(admin: AdminClient, path: string, id: string, audience?: "student" | "instructor"): Promise<MaterialRecord | null> {
  const { data, error } = await admin.storage.from(EHRGO_BUCKET).download(path);
  if (error) {
    if ("statusCode" in error && [400, 404].includes(Number(error.statusCode))) return null;
    throw unavailable();
  }
  if (!data || data.size > 4096) throw unavailable();
  let json: unknown;
  try { json = JSON.parse(await data.text()); } catch { throw unavailable(); }
  const parsed = RecordSchema.safeParse(json);
  if (!parsed.success) throw unavailable();
  const record = parsed.data;
  const extension = record.name.split(".").pop()!.toLowerCase();
  if (record.id !== id || (audience && record.audience !== audience) || record.contentType !== EHRGO_FILE_TYPES[extension] || record.storagePath !== `${EHRGO_UPLOAD_PREFIX}/${id}.${extension}`) throw unavailable();
  return record;
}

async function readyRecord(admin: AdminClient, id: string, audience: "student" | "instructor") {
  const record = await readRecord(admin, `${RECORD_PREFIX}/ready/${audience}/${id}.json`, id, audience);
  return record?.readyAt ? record : null;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next may construct an internal localhost URL behind a proxy. The incoming
  // Host and forwarded scheme describe the address used by the browser.
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (!origin || origin !== `${protocol}://${host}`) throw new ApiError(403, "Start the upload from the FordMS materials page.", "FORBIDDEN");
}

export async function listUploadedEhrgoMaterials(instructor: boolean, admin = createCourseAdminClient()): Promise<UploadedEhrgoMaterial[]> {
  const records: MaterialRecord[] = [];
  const audiences = instructor ? ["student", "instructor"] as const : ["student"] as const;
  for (const audience of audiences) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage.from(EHRGO_BUCKET).list(`${RECORD_PREFIX}/ready/${audience}`, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data) throw unavailable();
      const ids = data.filter((file) => file.name.endsWith(".json") && UUID.test(file.name.slice(0, -5))).map((file) => file.name.slice(0, -5));
      for (let start = 0; start < ids.length; start += 10) {
        const batch = await Promise.all(ids.slice(start, start + 10).map((id) => readyRecord(admin, id, audience)));
        records.push(...batch.filter((record): record is MaterialRecord => !!record));
      }
      if (data.length < 100) break;
    }
  }
  return records.sort((a, b) => b.readyAt!.localeCompare(a.readyAt!)).map(summary);
}

export async function findUploadedEhrgoDownload(id: string, admin: AdminClient): Promise<EhrgoDownload | undefined> {
  if (!id.startsWith("upload-") || !UUID.test(id.slice(7))) return undefined;
  const record = await readyRecord(admin, id.slice(7), "student") ?? await readyRecord(admin, id.slice(7), "instructor");
  if (!record) return undefined;
  return { id, name: record.name, audience: record.audience, bytes: record.bytes, storagePath: record.storagePath };
}

export async function prepareEhrgoUpload(admin: AdminClient, actor: string, input: z.infer<typeof EhrgoUploadSchema>) {
  const id = randomUUID();
  const extension = input.name.split(".").pop()!.toLowerCase();
  const contentType = EHRGO_FILE_TYPES[extension];
  const storagePath = `${EHRGO_UPLOAD_PREFIX}/${id}.${extension}`;
  const record: MaterialRecord = { ...input, id, contentType, storagePath, uploadedBy: actor, createdAt: new Date().toISOString(), readyAt: null };
  const stored = await admin.storage.from(EHRGO_BUCKET).upload(`${RECORD_PREFIX}/pending/${id}.json`, JSON.stringify(record), { contentType: "application/json", cacheControl: "0", upsert: false });
  if (stored.error) throw unavailable();
  const { data, error } = await admin.storage.from(EHRGO_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) throw new ApiError(503, "The upload could not be started. Please try again.", "UPLOAD_UNAVAILABLE");
  return { id, signedUrl: data.signedUrl, contentType };
}

export async function completeEhrgoUpload(admin: AdminClient, actor: string, id: string): Promise<UploadedEhrgoMaterial> {
  const record = await readRecord(admin, `${RECORD_PREFIX}/pending/${id}.json`, id);
  if (!record || record.uploadedBy !== actor) throw new ApiError(404, "This upload was not found.", "NOT_FOUND");
  const ready = await readyRecord(admin, id, record.audience);
  if (ready) return summary(ready);
  if (Date.now() - new Date(record.createdAt).getTime() > UPLOAD_LIFETIME_MS) throw new ApiError(410, "This upload expired. Choose the file and start again.", "UPLOAD_EXPIRED");
  const info = await admin.storage.from(EHRGO_BUCKET).info(record.storagePath);
  if (info.error || !info.data) throw new ApiError(409, "The file has not finished uploading. Try confirming it again.", "UPLOAD_INCOMPLETE");
  if (info.data.size !== record.bytes || info.data.size > EHRGO_MAX_UPLOAD_BYTES || info.data.contentType?.split(";")[0] !== record.contentType) {
    throw new ApiError(409, "The received file does not match this upload. Choose the file and start again.", "UPLOAD_MISMATCH");
  }
  const completed = { ...record, readyAt: new Date().toISOString() };
  const result = await admin.storage.from(EHRGO_BUCKET).upload(`${RECORD_PREFIX}/ready/${record.audience}/${id}.json`, JSON.stringify(completed), { contentType: "application/json", cacheControl: "0", upsert: false });
  if (result.error) {
    const concurrent = await readyRecord(admin, id, record.audience);
    if (concurrent) return summary(concurrent);
    throw unavailable();
  }
  await logAdminEvent(admin, actor, "ehrgo.material_uploaded", "ehrgo_material", id, { filename: record.name, activityId: record.activityId, audience: record.audience, bytes: record.bytes });
  return summary(completed);
}
