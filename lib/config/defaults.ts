import { defaultAssignments } from "../assignments";
import { alertRules, labExamples, medicationExamples, messageCategories, routingRules } from "../catalogs/clinical";
import { cptCatalog, icd10Catalog } from "../catalogs/codes";
import { coverageFields, departments, facilities, insurers, locations, organizations } from "../catalogs/coverage";
import { appointmentRules, noteTemplates, providerRoles, providers, specialties, visitTypes } from "../catalogs/scheduling";
import type { CourseConfig } from "./types";

export const VIEW_NAMES = [
  "Worklist", "Schedule", "Registration", "Patients", "MPI", "Encounter", "Orders & Results", "Portal", "HIE", "Analytics", "Query Studio", "AI Review", "Implementation", "Audit Review", "Assignments", "Quizzes", "Gradebook", "Admin",
  // v5 clinical revamp
  "eMAR", "Flowsheets", "In Basket", "Billing", "Tickets",
] as const;
export type View = (typeof VIEW_NAMES)[number];

/** Built-in content revision. Published configurations below this are upgraded on load (see lib/config/upgrade.ts). */
export const CONTENT_REVISION = 5;

export const defaultSimulatedRoles: CourseConfig["simulatedRoles"] = [
  { role: "Analyst", views: ["Worklist", "Tickets", "Patients", "Analytics", "Query Studio", "Audit Review", "HIE", "AI Review", "Assignments"] },
  { role: "Front Desk", views: ["Worklist", "Schedule", "Registration", "Patients", "MPI", "Assignments"] },
  { role: "Nurse", views: ["Worklist", "Patients", "eMAR", "Flowsheets", "In Basket", "Orders & Results", "Portal", "Assignments"] },
  { role: "Physician/APP", views: ["Worklist", "Patients", "Encounter", "Orders & Results", "In Basket", "Portal", "HIE", "AI Review", "Assignments"] },
  { role: "HIM", views: ["Worklist", "Patients", "MPI", "HIE", "Audit Review", "Analytics", "Assignments"] },
  { role: "Revenue Cycle", views: ["Worklist", "Billing", "Patients", "Registration", "Assignments"] },
  { role: "Implementation Lead", views: ["Worklist", "Tickets", "Analytics", "Implementation", "AI Review", "Assignments"] },
  { role: "Patient", views: ["Portal", "Assignments"] },
];

export const defaultCourseConfig: CourseConfig = {
  meta: {
    schema: 1,
    version: 0,
    label: "Built-in course defaults",
    effectiveDate: "2026-09-21",
    source: "FordMS built-in configuration (HINF 6105, Fall 2026)",
    teachingNotes: "All catalogs are curated teaching examples with synthetic data. They are not complete code sets and must not be used for patient care or billing.",
    contentRevision: CONTENT_REVISION,
  },
  icd10Catalog,
  cptCatalog,
  insurers,
  coverageFields,
  organizations,
  facilities,
  departments,
  locations,
  specialties,
  providerRoles,
  providers,
  visitTypes,
  noteTemplates,
  appointmentRules,
  medicationExamples,
  labExamples,
  alertRules,
  messageCategories,
  routingRules,
  simulatedRoles: defaultSimulatedRoles,
  assignments: defaultAssignments,
  permissions: { instructorCanPublishConfig: true, adminOnlyRoleChanges: true, rosterOnlySignIn: false },
};
