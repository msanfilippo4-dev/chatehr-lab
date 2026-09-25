import { z } from "zod";
import { CourseConfigSchema } from "../config/schema";

export const AuditEventSchema = z.object({
  id: z.string().min(1).max(64),
  timestamp: z.string().min(10).max(40),
  actor: z.string().max(80).default(""),
  action: z.string().min(1).max(80),
  patientId: z.string().max(40).optional().nullable(),
  detail: z.string().max(600).default(""),
  context: z.string().max(200).optional().nullable(),
  provenance: z.enum(["earned", "imported"]).optional(),
  actorRole: z.string().max(40).optional(),
});

/** Loose shape check for the workspace envelope; the full document is stored as JSON. */
export const WorkspaceEnvelopeSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  meta: z.object({ owner: z.string().max(120), createdAt: z.string(), configVersion: z.number().int().min(0) }).passthrough().optional(),
  patients: z.array(z.unknown()).min(1).max(200),
  audit: z.array(AuditEventSchema).max(2000),
}).passthrough();

export const SyncBodySchema = z.object({ workspace: WorkspaceEnvelopeSchema });

export const SubmitBodySchema = z.object({
  assignmentId: z.string().regex(/^FORDMS-A\d$/),
  reflection: z.string().trim().min(150, "The written analysis must contain at least 150 characters.").max(5000),
});

export const ResetBodySchema = z.object({
  scope: z.enum(["assignment", "all", "import"]),
  assignmentId: z.string().regex(/^FORDMS-A\d$/).optional(),
  workspace: WorkspaceEnvelopeSchema.optional(),
});

export const RubricScoreSchema = z.object({
  criterionIndex: z.number().int().min(0).max(20),
  pointsAwarded: z.number().min(0).max(100),
  comment: z.string().trim().max(1000).optional(),
});

export const GradeBodySchema = z.object({
  email: z.string().email().max(120),
  assignmentId: z.string().regex(/^FORDMS-A\d$/),
  version: z.number().int().min(1).optional(),
  rubric: z.array(RubricScoreSchema).max(20).optional(),
  score: z.number().min(0).max(100).optional(),
  feedback: z.string().trim().min(10, "Provide substantive feedback (10+ characters).").max(5000),
  finalize: z.boolean().default(true),
});

export const ReturnBodySchema = z.object({
  email: z.string().email().max(120),
  assignmentId: z.string().regex(/^FORDMS-A\d$/),
  comment: z.string().trim().min(10).max(3000),
});

export const InstructorResetBodySchema = z.object({
  email: z.string().email().max(120),
  scope: z.enum(["assignment", "all"]),
  assignmentId: z.string().regex(/^FORDMS-A\d$/).optional(),
});

export const RosterBodySchema = z.object({
  email: z.string().email().max(120),
  role: z.enum(["student", "instructor", "admin"]).optional(),
  enrollmentStatus: z.enum(["invited", "active", "dropped", "test"]).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  blackboardUsername: z.string().trim().max(80).optional(),
  section: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const ConfigPublishBodySchema = z.object({
  action: z.enum(["draft", "publish", "validate"]),
  config: CourseConfigSchema,
  changeSummary: z.string().trim().max(500).optional(),
});

export const ConfigRestoreBodySchema = z.object({ version: z.number().int().min(1), changeSummary: z.string().trim().max(500).optional() });

export const ReleaseBodySchema = z.object({
  assignmentId: z.string().regex(/^FORDMS-A\d$/),
  state: z.enum(["hidden", "released", "closed"]),
  releaseAt: z.string().datetime({ offset: true }).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  closeAt: z.string().datetime({ offset: true }).nullable().optional(),
  acceptLate: z.boolean().optional(),
});

// ---------------------------------------------------------------- weekly quizzes

const QuizAnswer = z.number().int().min(0).max(9).nullable();

/** One-step submit for fixed (legacy) quizzes: answers aligned to the fixed items. */
export const QuizFixedSubmitSchema = z.object({ answers: z.array(QuizAnswer).min(1).max(100) });

/** Submit or autosave for a drawn attempt: answers in DISPLAYED option order. */
export const QuizAttemptAnswersSchema = z.object({
  attempt: z.number().int().min(1).max(1000),
  answers: z.array(QuizAnswer).min(1).max(100),
});

/** Submit accepts either shape; `attempt` selects the drawn flow. */
export const QuizSubmitSchema = z.union([QuizAttemptAnswersSchema, QuizFixedSubmitSchema]);

const IsoTimestamp = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date and time.");

export const QuizSettingsBodySchema = z.object({
  week: z.number().int().min(1).max(12),
  opens_at: IsoTimestamp.nullable(),
  closes_at: IsoTimestamp.nullable(),
  time_limit_min: z.number().int().min(0).max(600).nullable(),
  draw_count: z.number().int().min(1).max(100).nullable(),
  attempts_allowed: z.number().int().min(0).max(100).nullable(),
  show_answers: z.enum(["after_close", "after_submit"]).nullable(),
}).refine((value) => !value.opens_at || !value.closes_at || Date.parse(value.opens_at) < Date.parse(value.closes_at), {
  message: "The quiz must open before it closes.",
  path: ["closes_at"],
});

export const QuizExtensionBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  week: z.number().int().min(1).max(12),
  extra_minutes: z.number().int().min(0).max(600).default(0),
  closes_at_override: IsoTimestamp.nullable().default(null),
  reason: z.string().trim().max(500).nullable().default(null),
}).refine((value) => value.extra_minutes > 0 || Boolean(value.closes_at_override), {
  message: "Give extra minutes, a later close, or both.",
  path: ["extra_minutes"],
});
