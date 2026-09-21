"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CourseAssignment, CourseConfig } from "@/lib/config/types";
import type { AssignmentRelease, CourseRole, CourseSubmission, EHRState, ProgressRow } from "@/lib/types";

export interface CourseData {
  user: { email: string; name?: string | null; role: CourseRole };
  assignments: CourseAssignment[];
  config: CourseConfig;
  configVersion: number;
  invalidSections?: { section: string; problems: string[] }[];
  releases: AssignmentRelease[];
  workspace: EHRState | null;
  workspaceUpdatedAt: string | null;
  resetMarkers: Record<string, string>;
  progress: ProgressRow[];
  submissions: CourseSubmission[];
}

export function useCourseData() {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await apiFetch<CourseData>("/api/course/bootstrap");
      setCourseData(payload);
      setError(null);
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Course records could not be loaded.");
      throw caught;
    }
  }, []);

  const mergeProgress = useCallback((rows: ProgressRow[]) => {
    setCourseData((current) => (current ? { ...current, progress: rows } : current));
  }, []);

  return { courseData, setCourseData, refresh, mergeProgress, error };
}
