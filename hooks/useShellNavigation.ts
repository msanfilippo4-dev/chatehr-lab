"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { View } from "@/lib/config/defaults";
import {
  ALWAYS_VISIBLE, DEFAULT_ROLE, DEFAULT_VIEW_FOR_ROLE, hrefFor, parseLocation, PATIENT_VIEWS, roleForView, type NavTarget,
} from "@/lib/navigation";
import type { Role } from "@/lib/types";

type Mode = "push" | "replace" | "none";

interface Options {
  initialView?: View;
  /** Views the course configuration grants to a simulated role. */
  viewsFor: (role: Role) => string[];
  /** Whether the signed-in user may open Gradebook and Admin. */
  isStaff: boolean;
  /** Called when a user-initiated navigation opens a chart (records the "Open chart" audit event). */
  onOpenChart: (patientId: string) => void;
}

interface NavState { role: Role; view: View; patientId: string; chartTab?: string }

/**
 * Role, view, patient, and chart tab for the shell, kept in sync with the URL.
 * Back/forward replay the URL; deep links switch to a role that can see the view.
 */
export function useShellNavigation({ initialView, viewsFor, isStaff, onOpenChart }: Options) {
  const [nav, setNav] = useState<NavState>({ role: DEFAULT_ROLE, view: initialView ?? "Worklist", patientId: "PT-001" });
  const navRef = useRef(nav);
  navRef.current = nav;
  const viewsForRef = useRef(viewsFor);
  viewsForRef.current = viewsFor;

  const allowed = useCallback((view: View, role: Role) => {
    if (ALWAYS_VISIBLE.has(view)) return true;
    if (view === "Gradebook" || view === "Admin") return isStaff;
    return viewsForRef.current(role).includes(view);
  }, [isStaff]);

  const apply = useCallback((target: Partial<NavTarget>, mode: Mode, recordOpen = false) => {
    const current = navRef.current;
    let view = target.view ?? current.view;
    const role = roleForView(view, current.role, target.role, (item) => viewsForRef.current(item));
    if (!allowed(view, role)) view = firstView(role, viewsForRef.current(role));
    const patientId = target.patient ?? current.patientId;
    const chartTab = view === "Patients" ? target.tab : undefined;
    const next: NavState = { role, view, patientId, chartTab };
    navRef.current = next;
    setNav(next);
    if (recordOpen && view === "Patients" && target.patient) onOpenChart(target.patient);
    if (mode === "none" || typeof window === "undefined") return;
    const showPatient = PATIENT_VIEWS.has(view) || Boolean(target.patient);
    const url = hrefFor({ view, role, patient: showPatient ? patientId : undefined, tab: chartTab });
    if (`${window.location.pathname}${window.location.search}` === url) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, [allowed, onOpenChart]);

  /** Apply the URL once the course configuration is known. */
  const initialize = useCallback(() => {
    const parsed = parseLocation(window.location.pathname, window.location.search);
    apply({ ...parsed, view: parsed.view ?? initialView ?? "Worklist" }, "replace");
  }, [apply, initialView]);

  useEffect(() => {
    function onPop() {
      const parsed = parseLocation(window.location.pathname, window.location.search);
      apply({ ...parsed, view: parsed.view ?? "Worklist" }, "none");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [apply]);

  const navigate = useCallback((target: NavTarget) => apply(target, "push", true), [apply]);

  const selectPatient = useCallback((patientId: string, view?: View) => apply({ patient: patientId, view }, view ? "push" : "replace"), [apply]);

  const setView = useCallback((view: View) => apply({ view }, "push"), [apply]);

  const changeRole = useCallback((role: Role) => {
    const current = navRef.current;
    const view = allowed(current.view, role) ? current.view : DEFAULT_VIEW_FOR_ROLE[role];
    apply({ view: allowed(view, role) ? view : firstView(role, viewsForRef.current(role)), role, patient: current.patientId }, "push");
  }, [allowed, apply]);

  const reset = useCallback((next: Partial<NavState>) => {
    apply({ view: next.view, role: next.role, patient: next.patientId }, "replace");
  }, [apply]);

  return { ...nav, navigate, selectPatient, setView, changeRole, initialize, reset };
}

function firstView(role: Role, views: string[]): View {
  return (views[0] as View | undefined) ?? DEFAULT_VIEW_FOR_ROLE[role] ?? "Assignments";
}
