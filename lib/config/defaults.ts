import { defaultAssignments } from "../assignments";
import { alertRules, labExamples, medicationExamples, messageCategories, routingRules } from "../catalogs/clinical";
import { cptCatalog, icd10Catalog } from "../catalogs/codes";
import { coverageFields, departments, facilities, insurers, locations, organizations } from "../catalogs/coverage";
import { appointmentRules, noteTemplates, providerRoles, providers, specialties, visitTypes } from "../catalogs/scheduling";
import type { CourseConfig } from "./types";

export const VIEW_NAMES = [
  "Worklist", "Schedule", "Registration", "Patients", "MPI", "Encounter", "Orders & Results", "Portal", "HIE", "Analytics", "Query Studio", "AI Review", "Implementation", "Audit Review", "Assignments", "Gradebook", "Admin",
] as const;
export type View = (typeof VIEW_NAMES)[number];

export const defaultCourseConfig: CourseConfig = {
  meta: {
    schema: 1,
    version: 0,
    label: "Built-in course defaults",
    effectiveDate: "2026-09-21",
    source: "FordMS built-in configuration (HINF 6105, Fall 2026)",
    teachingNotes: "All catalogs are curated teaching examples with synthetic data. They are not complete code sets and must not be used for patient care or billing.",
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
  simulatedRoles: [
    { role: "Front Desk", views: ["Worklist", "Schedule", "Registration", "Patients", "MPI", "Assignments"] },
    { role: "Clinical", views: ["Worklist", "Patients", "Encounter", "Orders & Results", "Portal", "HIE", "AI Review", "Assignments"] },
    { role: "HIM", views: ["Worklist", "Patients", "MPI", "HIE", "Audit Review", "Analytics", "Assignments"] },
    { role: "Patient", views: ["Portal", "Assignments"] },
    { role: "Analyst", views: ["Worklist", "Analytics", "Query Studio", "HIE", "Assignments"] },
    { role: "Implementation Lead", views: ["Worklist", "Analytics", "Implementation", "AI Review", "Assignments"] },
  ],
  assignments: defaultAssignments,
  permissions: { instructorCanPublishConfig: true, adminOnlyRoleChanges: true, rosterOnlySignIn: false },
};
