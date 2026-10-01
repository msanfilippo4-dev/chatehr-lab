import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const sourceRoot = resolve(process.argv[2] ?? "../../output/ehrgo-course-sheets");
const catalog = JSON.parse(await readFile("lib/server/ehrgo-catalog.json", "utf8"));
const inventory = JSON.parse(await readFile(resolve(sourceRoot, "manifests/download_inventory.json"), "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Course storage is not configured.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing, error: bucketError } = await admin.storage.getBucket(catalog.bucket);
if (!existing) {
  if (bucketError && !["404", "400"].includes(String(bucketError.statusCode))) throw new Error("Could not check course storage.");
  const { error } = await admin.storage.createBucket(catalog.bucket, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
  if (error) throw new Error(`Could not create private course storage: ${error.message}`);
} else if (existing.public) {
  throw new Error("Course materials must use a private bucket. Upload stopped.");
}

let count = 0;
for (const file of [...catalog.files, ...catalog.packages]) {
  const row = inventory.find((entry) => entry.resource_url.endsWith(`=${file.id.replace(/^file-/, "")}`));
  const path = row ? resolve(sourceRoot, row.relative_path) : resolve(sourceRoot, "..", file.name);
  const bytes = await readFile(path);
  if (bytes.length !== file.bytes || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error(`File integrity check failed: ${file.name}`);
  const { error } = await admin.storage.from(catalog.bucket).upload(file.storagePath, bytes, {
    contentType: file.contentType, cacheControl: "60", upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);
  count++;
  console.log(`Uploaded ${count}/57: ${file.name}`);
}
console.log("55 resources and 2 ZIP packages uploaded to private course storage.");
