"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const progressChannel = useRef<BroadcastChannel | null>(null);
  const owner = courseData?.user.email;

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
    progressChannel.current?.postMessage({ type: "course-saved", owner });
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    const reload = () => { void refresh().catch(() => undefined); };
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(`fordms-course:${owner}`); } catch { /* Focus refresh still works when cross-tab messaging is unavailable. */ }
    progressChannel.current = channel;
    if (channel) channel.onmessage = (event) => { if (event.data?.type === "course-saved" && event.data.owner === owner) reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      progressChannel.current = null;
      channel?.close();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [owner, refresh]);

  return { courseData, setCourseData, refresh, mergeProgress, error };
}
