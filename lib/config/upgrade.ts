/**
 * Upgrade a published course configuration written before the v5 clinical revamp.
 *
 * Every published version so far (v1–v19) predates content revision 5: it carries the
 * old simulated roles and assignment text. Rather than require the instructor to
 * republish, configs whose meta.contentRevision is below the built-in revision are
 * upgraded on load:
 *
 * - simulated roles: each role's views become the union of the published and default
 *   views; the new roles (Analyst's Tickets, Nurse, Physician/APP, Revenue Cycle) are
 *   added, and Nurse / Physician/APP inherit the legacy "Clinical" views;
 * - catalogs: default rows whose id is missing are appended (published rows win), and
 *   rows still carrying a known legacy default value are renamed (Crescent → Fordham Health);
 * - assignments: content (title, guide, requirements, rubric…) comes from the new defaults,
 *   while scheduling fields (due date, release state, weight) keep the published values.
 *
 * The result is stamped with the current revision, so a later publish from the admin
 * console is treated as authoritative and is never upgraded again.
 */
import type { CourseAssignment, CourseConfig } from "./types";

type Keyed = { id: string };

/** Catalog sections that are unioned by id. */
const ID_SECTIONS = [
  "insurers", "organizations", "facilities", "departments", "locations", "specialties", "providerRoles",
  "providers", "visitTypes", "noteTemplates", "medicationExamples", "labExamples", "alertRules", "messageCategories",
] as const;

/** Legacy default values that should follow the new defaults when unchanged. */
const LEGACY_RENAMES: Partial<Record<(typeof ID_SECTIONS)[number], Record<string, { field: string; legacy: string }>>> = {
  organizations: { "ORG-CH": { field: "name", legacy: "Crescent Health" } },
  facilities: { "FAC-LC": { field: "name", legacy: "Crescent Lincoln Center Clinic" } },
};

function unionById<T extends Keyed>(published: T[], defaults: T[], renames?: Record<string, { field: string; legacy: string }>): T[] {
  const byId = new Map(defaults.map((item) => [item.id, item]));
  const merged = published.map((item) => {
    const rename = renames?.[item.id];
    const fallback = byId.get(item.id);
    if (rename && fallback && (item as Record<string, unknown>)[rename.field] === rename.legacy) {
      return { ...item, [rename.field]: (fallback as Record<string, unknown>)[rename.field] } as T;
    }
    return item;
  });
  const ids = new Set(published.map((item) => item.id));
  return [...merged, ...defaults.filter((item) => !ids.has(item.id))];
}

function unionViews(first: string[], second: string[]): string[] {
  return [...new Set([...first, ...second])];
}

export function mergeRoles(published: CourseConfig["simulatedRoles"], defaults: CourseConfig["simulatedRoles"]): CourseConfig["simulatedRoles"] {
  const clinical = published.find((item) => item.role === "Clinical");
  const result = defaults.map((fallback) => {
    const existing = published.find((item) => item.role === fallback.role);
    if (existing) return { role: fallback.role, views: unionViews(fallback.views, existing.views) };
    if (clinical && (fallback.role === "Nurse" || fallback.role === "Physician/APP")) {
      // Legacy "Clinical" views carry over, except views that belong to the other clinical role.
      const other = fallback.role === "Nurse" ? ["Encounter", "HIE", "AI Review"] : [];
      return { role: fallback.role, views: unionViews(fallback.views, clinical.views.filter((view) => !other.includes(view))) };
    }
    return fallback;
  });
  // Keep roles that only exist in the published config (e.g. legacy "Clinical"); the role switcher hides them.
  const known = new Set(result.map((item) => item.role));
  return [...result, ...published.filter((item) => !known.has(item.role))];
}

const SCHEDULING_FIELDS = ["dueAt", "dueLabel", "releaseState", "weightPercent"] as const;

export function upgradeAssignments(published: CourseAssignment[], defaults: CourseAssignment[]): CourseAssignment[] {
  const merged = defaults.map((fallback) => {
    const existing = published.find((item) => item.id === fallback.id);
    if (!existing) return fallback;
    const scheduling = Object.fromEntries(SCHEDULING_FIELDS.map((field) => [field, existing[field]])) as Pick<CourseAssignment, (typeof SCHEDULING_FIELDS)[number]>;
    return { ...fallback, ...scheduling };
  });
  const ids = new Set(defaults.map((item) => item.id));
  return [...merged, ...published.filter((item) => !ids.has(item.id))];
}

export function needsContentUpgrade(config: CourseConfig, revision: number): boolean {
  return (config.meta?.contentRevision ?? 0) < revision;
}

export function upgradePublishedConfig(published: CourseConfig, defaults: CourseConfig): CourseConfig {
  const revision = defaults.meta.contentRevision ?? 0;
  if (!needsContentUpgrade(published, revision)) return published;
  const next: CourseConfig = { ...published };
  for (const section of ID_SECTIONS) {
    const current = published[section] as unknown as Keyed[] | undefined;
    const fallback = defaults[section] as unknown as Keyed[];
    (next as unknown as Record<string, unknown>)[section] = unionById(current ?? [], fallback, LEGACY_RENAMES[section]);
  }
  next.icd10Catalog = unionByCode(published.icd10Catalog ?? [], defaults.icd10Catalog);
  next.cptCatalog = unionByCode(published.cptCatalog ?? [], defaults.cptCatalog);
  next.simulatedRoles = mergeRoles(published.simulatedRoles ?? [], defaults.simulatedRoles);
  next.assignments = upgradeAssignments(published.assignments ?? [], defaults.assignments);
  next.meta = { ...published.meta, contentRevision: revision };
  return next;
}

function unionByCode<T extends { system: string; code: string }>(published: T[], defaults: T[]): T[] {
  const keys = new Set(published.map((item) => `${item.system}:${item.code}`));
  return [...published, ...defaults.filter((item) => !keys.has(`${item.system}:${item.code}`))];
}
