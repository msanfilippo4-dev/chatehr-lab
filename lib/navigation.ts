/**
 * URL-addressable navigation for FordMS.
 *
 * Every screen has a shareable URL: /?view=emar&patient=PT-008&role=nurse&tab=notes
 * (quizzes keep their /quizzes path). Assignment guides and tickets use the same
 * targets for deep links, and the browser back/forward buttons replay them.
 */
import type { View } from "./config/defaults";
import type { Role } from "./types";

export interface NavTarget {
  view: View;
  patient?: string;
  role?: Role;
  /** Chart tab inside the Patients view (e.g. "Notes", "Coding"). */
  tab?: string;
}

export const VIEW_SLUGS: Record<View, string> = {
  Worklist: "worklist",
  Schedule: "schedule",
  Registration: "registration",
  Patients: "chart",
  MPI: "mpi",
  Encounter: "encounter",
  "Orders & Results": "orders",
  Portal: "portal",
  HIE: "hie",
  Analytics: "analytics",
  "Query Studio": "query-studio",
  "AI Review": "ai-review",
  Implementation: "implementation",
  "Audit Review": "audit",
  Assignments: "assignments",
  Quizzes: "quizzes",
  Gradebook: "gradebook",
  Admin: "admin",
  eMAR: "emar",
  Flowsheets: "flowsheets",
  "In Basket": "in-basket",
  Billing: "billing",
  Tickets: "tickets",
};

export const ROLE_SLUGS: Record<Role, string> = {
  Analyst: "analyst",
  "Front Desk": "front-desk",
  Nurse: "nurse",
  "Physician/APP": "physician",
  HIM: "him",
  "Revenue Cycle": "revenue-cycle",
  "Implementation Lead": "implementation-lead",
  Patient: "patient",
  Clinical: "clinical",
};

/** Roles offered in the role switcher (the legacy "Clinical" role is not). */
export const SWITCHABLE_ROLES: Role[] = ["Analyst", "Front Desk", "Nurse", "Physician/APP", "HIM", "Revenue Cycle", "Implementation Lead", "Patient"];

export const DEFAULT_ROLE: Role = "Analyst";

export const DEFAULT_VIEW_FOR_ROLE: Record<Role, View> = {
  Analyst: "Tickets",
  "Front Desk": "Schedule",
  Nurse: "eMAR",
  "Physician/APP": "In Basket",
  HIM: "MPI",
  "Revenue Cycle": "Billing",
  "Implementation Lead": "Implementation",
  Patient: "Portal",
  Clinical: "Worklist",
};

export const ROLE_BLURBS: Record<Role, string> = {
  Analyst: "Clinical informatics analyst (you)",
  "Front Desk": "Scheduling and registration",
  Nurse: "4 West and clinic nursing",
  "Physician/APP": "Physicians and advanced practice providers",
  HIM: "Health information management",
  "Revenue Cycle": "Billing, coding, and denials",
  "Implementation Lead": "Go-live readiness",
  Patient: "Patient or proxy portal",
  Clinical: "Legacy combined clinical role",
};

export interface NavGroup { label: string; views: View[] }

export const NAV_GROUPS: NavGroup[] = [
  { label: "Workspace", views: ["Worklist", "Patients"] },
  { label: "Clinical", views: ["In Basket", "eMAR", "Flowsheets", "Encounter", "Orders & Results", "Portal"] },
  { label: "Front office", views: ["Schedule", "Registration"] },
  { label: "HIM", views: ["MPI", "HIE", "Audit Review"] },
  { label: "Revenue cycle", views: ["Billing"] },
  { label: "Analytics", views: ["Analytics", "Query Studio"] },
  { label: "Informatics", views: ["Tickets", "AI Review", "Implementation"] },
  { label: "Course", views: ["Assignments", "Quizzes", "Gradebook", "Admin"] },
];

/** Views that show the patient banner. */
export const PATIENT_VIEWS = new Set<View>(["Patients", "Encounter", "Orders & Results", "Portal", "eMAR", "Flowsheets", "Audit Review"]);

/** Views every signed-in user can open regardless of simulated role. */
export const ALWAYS_VISIBLE = new Set<View>(["Assignments", "Quizzes"]);

const slugToView = new Map(Object.entries(VIEW_SLUGS).map(([view, slug]) => [slug, view as View]));
const slugToRole = new Map(Object.entries(ROLE_SLUGS).map(([role, slug]) => [slug, role as Role]));

export function viewFromSlug(value: string | null | undefined): View | undefined {
  if (!value) return undefined;
  return slugToView.get(value.toLowerCase()) ?? (Object.keys(VIEW_SLUGS).includes(value) ? (value as View) : undefined);
}

export function roleFromSlug(value: string | null | undefined): Role | undefined {
  if (!value) return undefined;
  return slugToRole.get(value.toLowerCase()) ?? (Object.keys(ROLE_SLUGS).includes(value) ? (value as Role) : undefined);
}

/** Build the URL for a navigation target. */
export function hrefFor(target: Omit<Partial<NavTarget>, "view"> & { view: View | string }): string {
  const view = viewFromSlug(target.view) ?? (target.view as View);
  if (view === "Quizzes") return "/quizzes";
  const params = new URLSearchParams();
  params.set("view", VIEW_SLUGS[view] ?? String(target.view));
  if (target.patient) params.set("patient", target.patient);
  if (target.role) params.set("role", ROLE_SLUGS[target.role as Role] ?? String(target.role));
  if (target.tab) params.set("tab", target.tab.toLowerCase());
  return `/?${params.toString()}`;
}

/** Parse the current location into a navigation target (undefined fields were absent). */
export function parseLocation(pathname: string, search: string): Partial<NavTarget> {
  if (pathname.startsWith("/quizzes") || pathname.startsWith("/quiz")) return { view: "Quizzes" };
  const params = new URLSearchParams(search);
  const patient = params.get("patient") ?? undefined;
  return {
    view: viewFromSlug(params.get("view")),
    patient: patient && /^PT-[\w-]+$/.test(patient) ? patient : undefined,
    role: roleFromSlug(params.get("role")),
    tab: params.get("tab") ?? undefined,
  };
}

/**
 * Choose the simulated role for a target view: the requested role if it can see the view,
 * else the current role if it can, else the first switchable role that can.
 */
export function roleForView(view: View, current: Role, requested: Role | undefined, viewsFor: (role: Role) => string[]): Role {
  if (ALWAYS_VISIBLE.has(view) || view === "Gradebook" || view === "Admin") return requested ?? current;
  if (requested && viewsFor(requested).includes(view)) return requested;
  if (viewsFor(current).includes(view)) return current;
  return SWITCHABLE_ROLES.find((role) => viewsFor(role).includes(view)) ?? current;
}
