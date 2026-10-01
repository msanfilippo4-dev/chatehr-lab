import "server-only";
import catalog from "./ehrgo-catalog.json";

export type MaterialAudience = "student" | "instructor";
export interface EhrgoDownload {
  id: string;
  name: string;
  audience: MaterialAudience;
  bytes: number;
  storagePath: string;
}
export interface EhrgoFile extends EhrgoDownload { activityId: string }
export interface EhrgoActivity {
  id: string;
  title: string;
  category: "assigned" | "analytics" | "practice";
  url: string;
  due: string | null;
}

export const EHRGO_BUCKET = catalog.bucket;
export const EHRGO_ACTIVITIES = catalog.activities as EhrgoActivity[];
export const EHRGO_FILES = catalog.files as EhrgoFile[];
export const EHRGO_PACKAGES = catalog.packages as EhrgoDownload[];

/** IDs are resolved only against the catalog, never used as user-supplied paths. */
export function findEhrgoDownload(id: string): EhrgoDownload | undefined {
  return [...EHRGO_FILES, ...EHRGO_PACKAGES].find((file) => file.id === id);
}

export function visibleEhrgoFiles(activityId: string, instructor: boolean) {
  return EHRGO_FILES.filter((file) => file.activityId === activityId && (file.audience === "student" || instructor));
}

export function materialSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
