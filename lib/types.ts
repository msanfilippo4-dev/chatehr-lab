// ---------------------------------------------------------------------------
// Shared TypeScript types for ChartEHR Project
// ---------------------------------------------------------------------------

// ── Patient Data ──────────────────────────────────────────────────────────

export interface Condition {
  code: string;
  display: string;
  onset: string;
}

export interface LabResult {
  name: string;
  value: number;
  unit: string;
  flag: string;
  date: string;
}

export interface Immunization {
  name: string;
  cvx: string;
  date: string;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  route: string;
  status: "Active" | "Discontinued";
  started: string;
}

export interface Allergy {
  allergen: string;
  reaction: string;
  severity: "Mild" | "Moderate" | "Severe/Anaphylaxis";
}

export interface Vitals {
  bp: string;
  hr: number;
  rr: number;
  spo2: number;
  temp: string;
  weight: string;
}

export interface Visit {
  date: string;
  type: "Office Visit" | "ED Visit" | "Telehealth" | "Hospital Admission";
  provider: string;
  chiefComplaint: string;
  assessment: string;
  plan: string;
  vitals: Vitals;
  notes: string;
}

export interface ImagingReport {
  date: string;
  modality: string;
  bodyPart: string;
  findings: string;
  impression: string;
  orderingProvider: string;
}

export interface SocialHistory {
  smokingStatus: string;
  alcoholUse: string;
  exerciseFrequency: string;
  occupation: string;
  livingSituation: string;
}

export interface ClinicalNote {
  date: string;
  author: string;
  noteType: string;
  content: string;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: string;
  race?: string;
  ethnicity?: string;
  language?: string;
  maritalStatus?: string;
  addressZip?: string;
  insuranceType?: string;
  conditions: Condition[];
  labs: LabResult[];
  immunizations: Immunization[];
  medications: Medication[];
  allergies: Allergy[];
  visits: Visit[];
  imagingReports?: ImagingReport[];
  socialHistory?: SocialHistory;
  clinicalNotes?: ClinicalNote[];
  lastVisit: string;
  isComplex?: boolean;
}

// ── RAG ───────────────────────────────────────────────────────────────────

export interface RAGChunk {
  id: string;
  source: string;
  title: string;
  text: string;
  keywords: string[];
}

export interface RAGRetrievalInsight extends RAGChunk {
  score?: number;
  preview?: string;
  matchedTerms?: string[];
  matchedKeywords?: string[];
  rationale?: string;
}

export interface RAGObservabilityMetadata {
  enabled: boolean;
  method: "keyword" | "embedding" | "hybrid";
  topK: number;
  query: string;
  queryTerms: string[];
  patientConditionTerms: string[];
  retrievedChunkCount: number;
  retrievedChunks: RAGRetrievalInsight[];
}

// ── Messages ──────────────────────────────────────────────────────────────

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
  modelLatencyMs?: number;
  totalLatencyMs?: number;
  historyMessagesUsed?: number;
  ragChunksUsed?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  usage?: UsageMetadata;
  ragChunks?: RAGRetrievalInsight[];
  isError?: boolean;
  hint?: string;
}

// ── Context ───────────────────────────────────────────────────────────────

export type ContextLevel = "LIMITED" | "STANDARD" | "FULL";

export interface SectionToggles {
  demographics: boolean;
  conditions: boolean;
  medications: boolean;
  allergies: boolean;
  labs: boolean;
  vitals: boolean;
  immunizations: boolean;
  visits: boolean;
  imaging: boolean;
  socialHistory: boolean;
  clinicalNotes: boolean;
}

// ── Teams ─────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  role: "lead" | "member";
  joinedAt: string;
}

// ── Model Layer ───────────────────────────────────────────────────────────

export type ModelProvider = "gemini" | "openrouter";

export interface ModelRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: string;
  timeout?: number;
}

export interface ModelResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  finishReason: string;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export type ProjectMilestoneKey =
  | "orientation"
  | "controlled_experiments"
  | "practice_benchmark"
  | "checkpoint_benchmark"
  | "final_benchmark"
  | "final_reflection";

// ── Config ────────────────────────────────────────────────────────────────

export interface ConfigSnapshot {
  // Identity (not hashed)
  id?: string;
  teamId?: string;
  name?: string;
  createdAt?: string;
  createdBy?: string;

  // ── Provider / Model (knobs 1-6) ──
  modelProvider: ModelProvider;
  modelName: string;
  fallbackModel: string;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  retries: number;

  // ── Sampling (knobs 7-11) ──
  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;

  // ── Prompt Engineering (knobs 12-18) ──
  systemInstruction: string;
  styleProfile: "clinical" | "conversational" | "terse";
  responseFormat: "free-form" | "structured" | "chain-of-thought";
  fewShotCount: number;
  safetyPreambleEnabled: boolean;
  citationRequired: boolean;
  abstainRule: string;

  // ── Context / RAG (knobs 19-26) ──
  contextLevel: ContextLevel;
  noteWindow: number;
  sectionToggles: SectionToggles;
  summaryPrepass: boolean;
  ragEnabled: boolean;
  ragTopK: number;
  ragMethod: "keyword" | "embedding" | "hybrid";
  ragReranker: boolean;

  // ── Memory (knobs 27-28) ──
  historyDepth: number;
  memoryStrategy: "none" | "sliding-window" | "summary";

  // ── Guardrails (knobs 29-30) ──
  confidenceFloor: number;
  perTurnTokenBudget: number;

  // ── Budget (knob 31) ──
  perRunBudgetCap: number;

  // ── Versioning (knobs 32-34) ──
  version: number;
  configHash: string;
  isFrozen: boolean;
}

// ── Benchmark ─────────────────────────────────────────────────────────────

export type BenchmarkCategory =
  | "medication_safety"
  | "lab_interpretation"
  | "guideline_adherence"
  | "clinical_summarization"
  | "population_health"
  | "safety_robustness"
  | "bias_equity";

export interface BenchmarkCase {
  id: string;
  category: BenchmarkCategory;
  title: string;
  description: string;
  patientId: string | null;
  recommendedPatientId?: string | null;
  prompt: string;
  groundTruth: Record<string, unknown>;
  scoringMethod: "deterministic" | "hybrid" | "llm_judge";
  maxScore: number;
  difficulty: "easy" | "medium" | "hard";
  caseSet: "public" | "hidden" | "adversarial";
  packId: "practice" | "checkpoint" | "final";
  phase: "practice" | "checkpoint" | "final";
  learningObjective?: string;
  evidenceChecklist?: string[];
  fairnessDimension?: string | null;
  recommendedComparison?: string | null;
}

export interface BenchmarkCaseResult {
  id?: string;
  runId: string;
  caseId: string;
  modelResponse: string;
  modelName: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  deterministicScore: number | null;
  rubricScore: number | null;
  judgeScore: number | null;
  finalScore: number;
  maxScore: number;
  scoringDetails: Record<string, unknown>;
  isHallucination: boolean;
  isFlagged: boolean;
  langfuseTraceId: string | null;
}

export interface BenchmarkRun {
  id: string;
  teamId: string;
  configId: string;
  configHash: string;
  runMode: "practice" | "checkpoint" | "official";
  packId?: "practice" | "checkpoint" | "final";
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  accuracyScore?: number;
  safetyScore?: number;
  biasEquityScore?: number;
  tournamentScore?: number;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
  totalCostUsd?: number;
  totalTokens?: number;
  hallucinationCount?: number;
  consistencyScore?: number;
  langfuseSessionId?: string;
  results?: BenchmarkCaseResult[];
}

// ── Leaderboard ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  configHash: string;
  modelName: string;
  compositeScore: number;
  accuracyScore: number;
  safetyScore: number;
  biasEquityScore?: number;
  totalCost: number;
  avgLatencyMs: number;
  runId: string;
  submittedAt: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── Legacy LabConfig (backward compat) ────────────────────────────────────

export interface LabConfig {
  modelName: string;
  systemInstruction: string;
  temperature: number;
  contextLevel: ContextLevel;
  ragEnabled: boolean;
}

export interface ExperimentSlotResult {
  configId: string;
  configName: string;
  modelName: string;
  modelProvider: ModelProvider;
  output: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  ragChunks: RAGRetrievalInsight[];
  ragMetadata?: RAGObservabilityMetadata;
}

export interface ExperimentRun {
  id: string;
  teamId: string;
  userId: string;
  patientId: string;
  patientName: string;
  prompt: string;
  recipeId?: string | null;
  variableFocus?: string | null;
  slots: ExperimentSlotResult[];
  createdAt: string;
}

export interface NotebookEntry {
  id: string;
  teamId: string;
  userId: string;
  category:
    | "hypothesis"
    | "observation"
    | "governance"
    | "bias_equity"
    | "cost"
    | "reflection";
  title: string;
  content: string;
  linkedExperimentId?: string | null;
  tags?: string[];
  createdAt: string;
}

export interface ReflectionSubmission {
  id: string;
  teamId: string;
  userId: string;
  bestConfigId?: string | null;
  title: string;
  summary: string;
  benchmarkEvidence: string;
  costObservability: string;
  biasEquityRisk: string;
  safetyControl: string;
  deploymentRecommendation: string;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneStatus {
  id: string;
  teamId: string;
  milestoneKey: ProjectMilestoneKey;
  completed: boolean;
  completedAt?: string | null;
  notes?: string | null;
}

export interface TeamObservabilitySnapshot {
  id: string;
  teamId: string;
  sourceType: "chat" | "experiment" | "benchmark";
  sourceId: string;
  modelName: string;
  provider: ModelProvider;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface InstructorFlag {
  id: string;
  teamId: string;
  runId?: string | null;
  caseId?: string | null;
  flagType: "safety" | "bias_equity" | "hallucination" | "cost";
  severity: "low" | "medium" | "high";
  summary: string;
  details?: string | null;
  createdAt: string;
}
