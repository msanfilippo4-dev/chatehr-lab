import { defaultCourseConfig } from "./defaults";
import { CourseConfigSchema, SECTION_SCHEMAS } from "./schema";
import type { CourseConfig, CourseConfigSection } from "./types";

export interface MergeResult {
  config: CourseConfig;
  invalidSections: { section: string; problems: string[] }[];
}

/**
 * Overlay a published configuration document on the built-in defaults.
 * Each section is validated independently; a section that fails validation
 * keeps the default value so a bad publish never blanks the whole catalog.
 */
export function mergeConfig(defaults: CourseConfig, published: unknown): MergeResult {
  if (!published || typeof published !== "object") return { config: defaults, invalidSections: [] };
  const full = CourseConfigSchema.safeParse(published);
  if (full.success) return { config: { ...defaults, ...(full.data as CourseConfig) }, invalidSections: [] };

  const source = published as Record<string, unknown>;
  const merged: CourseConfig = { ...defaults };
  const invalid: MergeResult["invalidSections"] = [];
  for (const key of Object.keys(SECTION_SCHEMAS) as (keyof CourseConfig)[]) {
    if (!(key in source)) continue;
    const parsed = SECTION_SCHEMAS[key].safeParse(source[key]);
    if (parsed.success) {
      (merged as unknown as Record<string, unknown>)[key] = parsed.data;
    } else {
      invalid.push({ section: key, problems: parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || key}: ${issue.message}`) });
    }
  }
  return { config: merged, invalidSections: invalid };
}

export function studentSafeConfig(config: CourseConfig): CourseConfig {
  return {
    ...config,
    assignments: config.assignments.filter((assignment) => assignment.releaseState !== "hidden"),
  };
}

export function sectionKeys(): CourseConfigSection[] {
  return (Object.keys(SECTION_SCHEMAS) as (keyof CourseConfig)[]).filter((key): key is CourseConfigSection => key !== "meta");
}

export { defaultCourseConfig };
