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
  version: z.union([z.literal(2), z.literal(3)]),
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
