import { defaultCourseConfig } from "../config/defaults";
import { mergeConfig } from "../config/merge";
import type { CourseAssignment, CourseConfig } from "../config/types";
import type { AssignmentRelease } from "../types";
import type { AdminClient } from "./course-db";
import { logAdminEvent } from "./course-db";
import { ApiError } from "./errors";

export interface LoadedConfig {
  config: CourseConfig;
  version: number;
  publishedAt: string | null;
  invalidSections: { section: string; problems: string[] }[];
}

export async function loadPublishedConfig(admin: AdminClient): Promise<LoadedConfig> {
  const { data, error } = await admin.from("ehr_config_versions").select("version,config,published_at").eq("status", "published").maybeSingle();
  if (error) {
    // Table missing (migration not applied yet) → defaults.
    console.error("[fordms] config load failed; using defaults", error.message);
    return { config: defaultCourseConfig, version: 0, publishedAt: null, invalidSections: [] };
  }
  if (!data) return { config: defaultCourseConfig, version: 0, publishedAt: null, invalidSections: [] };
  const merged = mergeConfig(defaultCourseConfig, data.config);
  merged.config.meta = { ...merged.config.meta, version: data.version };
  return { config: merged.config, version: data.version, publishedAt: data.published_at, invalidSections: merged.invalidSections };
}

export async function loadReleases(admin: AdminClient): Promise<AssignmentRelease[]> {
  const { data, error } = await admin.from("ehr_assignment_releases").select("assignment_id,state,release_at,due_at,close_at,accept_late");
  if (error) {
    console.error("[fordms] releases unavailable", error.message);
    return [];
  }
  return (data ?? []) as AssignmentRelease[];
}

/** Overlay release-table state and due dates on configured assignments. The release table wins. */
export function applyReleases(assignments: CourseAssignment[], releases: AssignmentRelease[]): CourseAssignment[] {
  return assignments.map((assignment) => {
    const release = releases.find((row) => row.assignment_id === assignment.id);
    if (!release) return assignment;
    return {
      ...assignment,
      releaseState: release.state,
      dueAt: release.due_at ?? assignment.dueAt,
      dueLabel: release.due_at ? formatDueLabel(release.due_at) : assignment.dueLabel,
    };
  });
}

export function formatDueLabel(iso: string): string {
  try {
    const date = new Date(iso);
    const text = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
    return `${text} ET`;
  } catch {
    return iso;
  }
}

export async function loadEffectiveAssignments(admin: AdminClient) {
  const [loaded, releases] = await Promise.all([loadPublishedConfig(admin), loadReleases(admin)]);
  return { ...loaded, releases, assignments: applyReleases(loaded.config.assignments, releases) };
}

export async function listConfigVersions(admin: AdminClient) {
  const { data, error } = await admin.from("ehr_config_versions").select("version,status,change_summary,created_by,created_at,published_by,published_at").order("version", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getConfigVersion(admin: AdminClient, version: number) {
  const { data, error } = await admin.from("ehr_config_versions").select("version,status,config,change_summary,created_by,created_at,published_by,published_at").eq("version", version).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "That configuration version does not exist.", "NOT_FOUND");
  return data;
}

export async function saveConfigVersion(admin: AdminClient, config: CourseConfig, actor: string, status: "draft" | "published", changeSummary?: string) {
  const { data: latest, error: latestError } = await admin.from("ehr_config_versions").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw latestError;
  const version = (latest?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const document: CourseConfig = { ...config, meta: { ...config.meta, version, label: config.meta.label || `Version ${version}` } };
  if (status === "published") {
    const { error: archiveError } = await admin.from("ehr_config_versions").update({ status: "archived" }).eq("status", "published");
    if (archiveError) throw archiveError;
  }
  const { error } = await admin.from("ehr_config_versions").insert({
    version,
    status,
    config: document,
    change_summary: changeSummary ?? null,
    created_by: actor,
    created_at: now,
    published_by: status === "published" ? actor : null,
    published_at: status === "published" ? now : null,
  });
  if (error) throw error;
  await logAdminEvent(admin, actor, status === "published" ? "config_published" : "config_draft_saved", "config", String(version), { changeSummary: changeSummary ?? "" });
  return { version, status, publishedAt: status === "published" ? now : null };
}

export async function upsertRelease(admin: AdminClient, actor: string, release: { assignmentId: string; state: string; releaseAt?: string | null; dueAt?: string | null; closeAt?: string | null; acceptLate?: boolean }) {
  const { error } = await admin.from("ehr_assignment_releases").upsert({
    assignment_id: release.assignmentId,
    state: release.state,
    release_at: release.releaseAt ?? null,
    due_at: release.dueAt ?? null,
    close_at: release.closeAt ?? null,
    accept_late: release.acceptLate ?? true,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  }, { onConflict: "assignment_id" });
  if (error) throw error;
  await logAdminEvent(admin, actor, "release_updated", "assignment", release.assignmentId, { ...release });
}
