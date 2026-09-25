import { z } from "zod";
import { isActionId } from "../actions";

const short = z.string().trim().min(1).max(200);
const text = z.string().trim().max(2000);
const id = z.string().trim().min(1).max(64);

const safeRegex = z.string().max(120).refine((value) => {
  try {
    new RegExp(value, "i");
    return true;
  } catch {
    return false;
  }
}, "Pattern must be a valid regular expression");

export const CodeEntrySchema = z.object({
  system: z.enum(["ICD-10-CM", "CPT"]),
  code: z.string().trim().min(1).max(12),
  display: short,
  use: short,
  version: short,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "retired", "example"]),
  source: text,
  teachingNote: text,
});

export const InsurerSchema = z.object({ id, name: short, payerType: z.enum(["Medicaid", "Medicare", "Commercial", "Self-pay", "Other"]), planTypes: z.array(short).min(1).max(10), eligibilityNote: text });
export const CoverageFieldsSchema = z.object({ eligibilityStatuses: z.array(short).min(1), cobOrders: z.array(short).min(1), verificationSources: z.array(short).min(1) });
export const OrganizationSchema = z.object({ id, name: short, type: short });
export const FacilitySchema = z.object({ id, organizationId: id, name: short, address: short });
export const DepartmentSchema = z.object({ id, facilityId: id, name: short });
export const LocationSchema = z.object({ id, departmentId: id, name: short, kind: short });
export const SpecialtySchema = z.object({ id, name: short });
export const ProviderRoleSchema = z.object({ id, name: short, canSign: z.boolean(), canCosign: z.boolean() });
export const ProviderSchema = z.object({
  id, name: short, credentials: short, specialtyId: id, roleId: id, facilityId: id,
  availability: z.array(z.object({ day: z.number().int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).max(14),
});
export const VisitTypeSchema = z.object({ id, label: short, durationMinutes: z.number().int().min(5).max(240), resources: z.array(short).max(6), noteTemplateId: id.optional() });
export const NoteTemplateSchema = z.object({ id, name: short, subjective: text, objective: text, assessment: text, plan: text, copyForwardAllowed: z.boolean(), guidance: text });
export const AppointmentRulesSchema = z.object({
  conflictKeys: z.array(z.enum(["provider", "date", "time"])).min(1),
  minLeadMinutes: z.number().int().min(0).max(10080),
  maxDailyPerProvider: z.number().int().min(1).max(100),
  cancellationReasons: z.array(short).min(1).max(20),
  waitlistEnabled: z.boolean(),
  noShowAfterMinutes: z.number().int().min(0).max(240),
  reminderLeadHours: z.number().int().min(0).max(336),
});
export const MedicationExampleSchema = z.object({ id, name: short, sig: short, drugClass: short, teachingNote: text });
export const LabExampleSchema = z.object({ id, name: short, specimen: short, sampleResult: short, flag: z.string().max(20), teachingNote: text });
export const AlertRuleSchema = z.object({
  id, kind: z.enum(["allergy", "duplicate", "interaction", "dose"]), orderPattern: safeRegex, allergenPattern: safeRegex.optional(),
  severity: z.enum(["Info", "Warning", "Critical"]), message: text, requiresOverrideReason: z.boolean(),
});
export const MessageCategorySchema = z.object({ id, name: short, description: text });
export const RoutingRuleSchema = z.object({ categoryId: id, keywordPattern: safeRegex, routeTo: short, priority: z.enum(["Routine", "Same day", "Urgent"]) });

export const RequirementSchema = z.object({
  action: z.string().refine(isActionId, "Unknown action identifier"),
  label: short,
  minimumCount: z.number().int().min(1).max(10),
  contextMatch: z.string().max(60).optional(),
  anyOf: z.array(z.string().refine(isActionId, "Unknown action identifier")).max(4).optional(),
});

const GuideLinkSchema = z.object({ label: short, view: short, patient: id.optional(), role: short.optional(), tab: short.optional() });
const GuideCheckSchema = z.object({ action: z.string().refine(isActionId, "Unknown action identifier"), contextMatch: z.string().max(60).optional(), anyOf: z.array(z.string().refine(isActionId)).max(4).optional() });
export const GuideStepSchema = z.object({ text: text, link: GuideLinkSchema.optional(), expect: text.optional(), check: GuideCheckSchema.optional() });
export const GuidePartSchema = z.object({ title: short, minutes: z.number().int().min(1).max(180), steps: z.array(GuideStepSchema).min(1).max(15), tip: text.optional() });
export const AssignmentGuideSchema = z.object({ situation: text, parts: z.array(GuidePartSchema).min(1).max(8) });
export const RubricItemSchema = z.object({ criterion: short, points: z.number().min(0).max(100), standard: text });
export const AssignmentSchema = z.object({
  id: z.string().regex(/^FORDMS-A\d$/),
  title: short,
  shortTitle: short,
  estimatedMinutes: z.number().int().min(15).max(600),
  dueAt: z.string().datetime({ offset: true }),
  dueLabel: short,
  weightPercent: z.number().min(0).max(100),
  weekIntroduced: z.number().int().min(1).max(12),
  scenario: text,
  objectives: z.array(short).min(1).max(8),
  workflow: z.array(text).min(1).max(12),
  requirements: z.array(RequirementSchema).min(1).max(14),
  submissionPrompt: text,
  rubric: z.array(RubricItemSchema).min(1).max(10).refine((items) => Math.abs(items.reduce((sum, item) => sum + item.points, 0) - 100) < 0.001, "Rubric points must total 100"),
  releaseState: z.enum(["hidden", "released", "closed"]),
  contentRevision: z.number().int().min(0).max(1000).optional(),
  guide: AssignmentGuideSchema.optional(),
});

export const CourseConfigSchema = z.object({
  meta: z.object({ schema: z.literal(1), version: z.number().int().min(0), label: short, effectiveDate: z.string(), source: text, teachingNotes: text, contentRevision: z.number().int().min(0).max(1000).optional() }),
  icd10Catalog: z.array(CodeEntrySchema).max(200),
  cptCatalog: z.array(CodeEntrySchema).max(200),
  insurers: z.array(InsurerSchema).max(50),
  coverageFields: CoverageFieldsSchema,
  organizations: z.array(OrganizationSchema).max(50),
  facilities: z.array(FacilitySchema).max(50),
  departments: z.array(DepartmentSchema).max(100),
  locations: z.array(LocationSchema).max(200),
  specialties: z.array(SpecialtySchema).max(50),
  providerRoles: z.array(ProviderRoleSchema).max(20),
  providers: z.array(ProviderSchema).min(1).max(100),
  visitTypes: z.array(VisitTypeSchema).min(1).max(50),
  noteTemplates: z.array(NoteTemplateSchema).max(20),
  appointmentRules: AppointmentRulesSchema,
  medicationExamples: z.array(MedicationExampleSchema).max(100),
  labExamples: z.array(LabExampleSchema).max(100),
  alertRules: z.array(AlertRuleSchema).max(50),
  messageCategories: z.array(MessageCategorySchema).max(20),
  routingRules: z.array(RoutingRuleSchema).max(50),
  simulatedRoles: z.array(z.object({ role: z.enum(["Analyst", "Front Desk", "Nurse", "Physician/APP", "HIM", "Revenue Cycle", "Implementation Lead", "Patient", "Clinical"]), views: z.array(short).min(1) })).min(1),
  assignments: z.array(AssignmentSchema).min(1).max(8),
  permissions: z.object({ instructorCanPublishConfig: z.boolean(), adminOnlyRoleChanges: z.boolean(), rosterOnlySignIn: z.boolean().default(false) }),
});

export type CourseConfigInput = z.input<typeof CourseConfigSchema>;

export const SECTION_SCHEMAS = CourseConfigSchema.shape;
