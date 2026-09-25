import type { AssignmentRequirement } from "../progress";
import type { ReleaseState, Role } from "../types";

export type CodeSystem = "ICD-10-CM" | "CPT";

export interface CodeEntry {
  system: CodeSystem;
  code: string;
  display: string;
  /** Category used for teaching, e.g. "Diagnosis / condition" or "Procedure / service". */
  use: string;
  version: string;
  effectiveDate: string;
  status: "active" | "retired" | "example";
  source: string;
  teachingNote: string;
}

export interface Insurer {
  id: string;
  name: string;
  payerType: "Medicaid" | "Medicare" | "Commercial" | "Self-pay" | "Other";
  planTypes: string[];
  eligibilityNote: string;
}

export interface CoverageFields {
  eligibilityStatuses: string[];
  cobOrders: string[];
  verificationSources: string[];
}

export interface Organization { id: string; name: string; type: string }
export interface Facility { id: string; organizationId: string; name: string; address: string }
export interface Department { id: string; facilityId: string; name: string }
export interface Location { id: string; departmentId: string; name: string; kind: string }

export interface Specialty { id: string; name: string }
export interface ProviderRole { id: string; name: string; canSign: boolean; canCosign: boolean }

export interface Availability { day: number; start: string; end: string }

export interface Provider {
  id: string;
  name: string;
  credentials: string;
  specialtyId: string;
  roleId: string;
  facilityId: string;
  availability: Availability[];
}

export interface VisitType {
  id: string;
  label: string;
  durationMinutes: number;
  resources: string[];
  noteTemplateId?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  copyForwardAllowed: boolean;
  guidance: string;
}

export interface AppointmentRules {
  conflictKeys: ("provider" | "date" | "time")[];
  minLeadMinutes: number;
  maxDailyPerProvider: number;
  cancellationReasons: string[];
  waitlistEnabled: boolean;
  noShowAfterMinutes: number;
  reminderLeadHours: number;
}

export interface MedicationExample {
  id: string;
  name: string;
  sig: string;
  drugClass: string;
  teachingNote: string;
}

export interface LabExample {
  id: string;
  name: string;
  specimen: string;
  sampleResult: string;
  flag: string;
  teachingNote: string;
}

export interface AlertRule {
  id: string;
  kind: "allergy" | "duplicate" | "interaction" | "dose";
  orderPattern: string;
  allergenPattern?: string;
  severity: "Info" | "Warning" | "Critical";
  message: string;
  requiresOverrideReason: boolean;
}

export interface MessageCategory { id: string; name: string; description: string }
export interface RoutingRule { categoryId: string; keywordPattern: string; routeTo: string; priority: "Routine" | "Same day" | "Urgent" }

export interface AssignmentRubricItem { criterion: string; points: number; standard: string }

/** An in-app deep link: view name plus optional patient, simulated role, and chart tab. */
export interface GuideLink { label: string; view: string; patient?: string; role?: string; tab?: string }

export interface GuideStep {
  text: string;
  link?: GuideLink;
  /** "You should see…" confirmation. */
  expect?: string;
  /** When set, the step ticks off once matching audit evidence exists. */
  check?: { action: string; contextMatch?: string; anyOf?: string[] };
}

export interface GuidePart { title: string; minutes: number; steps: GuideStep[]; tip?: string }

export interface AssignmentGuide {
  /** "Your situation", in the voice of Dana Okafor's clinical informatics analyst. */
  situation: string;
  parts: GuidePart[];
}

export interface CourseAssignment {
  id: string;
  title: string;
  shortTitle: string;
  estimatedMinutes: number;
  /** ISO timestamp in America/New_York offset. */
  dueAt: string;
  dueLabel: string;
  weightPercent: number;
  weekIntroduced: number;
  scenario: string;
  objectives: string[];
  workflow: string[];
  requirements: AssignmentRequirement[];
  submissionPrompt: string;
  rubric: AssignmentRubricItem[];
  releaseState: ReleaseState;
  /** Content revision of the built-in text; published configs older than the default are upgraded. */
  contentRevision?: number;
  guide?: AssignmentGuide;
}

export interface CourseConfigMeta {
  schema: 1;
  version: number;
  label: string;
  effectiveDate: string;
  source: string;
  teachingNotes: string;
  /** Built-in content revision this document was based on (5 = FordMS v5 clinical revamp). */
  contentRevision?: number;
}

export interface CourseConfig {
  meta: CourseConfigMeta;
  icd10Catalog: CodeEntry[];
  cptCatalog: CodeEntry[];
  insurers: Insurer[];
  coverageFields: CoverageFields;
  organizations: Organization[];
  facilities: Facility[];
  departments: Department[];
  locations: Location[];
  specialties: Specialty[];
  providerRoles: ProviderRole[];
  providers: Provider[];
  visitTypes: VisitType[];
  noteTemplates: NoteTemplate[];
  appointmentRules: AppointmentRules;
  medicationExamples: MedicationExample[];
  labExamples: LabExample[];
  alertRules: AlertRule[];
  messageCategories: MessageCategory[];
  routingRules: RoutingRule[];
  simulatedRoles: { role: Role; views: string[] }[];
  assignments: CourseAssignment[];
  permissions: { instructorCanPublishConfig: boolean; adminOnlyRoleChanges: boolean; rosterOnlySignIn: boolean };
}

export type CourseConfigSection = Exclude<keyof CourseConfig, "meta">;
