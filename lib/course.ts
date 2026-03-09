import type { ProjectMilestoneKey } from "./types";

export const TEAM_ROLES = [
  {
    id: "workflow-lead",
    title: "Workflow Lead",
    description:
      "Keeps the team on the runbook, tracks the patient/story context, and makes sure comparisons stay controlled.",
  },
  {
    id: "model-analyst",
    title: "Model Analyst",
    description:
      "Owns config changes and explains what each model, temperature, and context change is expected to do.",
  },
  {
    id: "governance-lead",
    title: "Governance Lead",
    description:
      "Tracks bias, equity, privacy, verification steps, and whether the answer is safe to trust.",
  },
  {
    id: "observability-lead",
    title: "Observability Lead",
    description:
      "Records latency, tokens, costs, and which settings create the best tradeoff for the team.",
  },
] as const;

export const PROJECT_MILESTONES: Array<{
  key: ProjectMilestoneKey;
  title: string;
  estimate: string;
  description: string;
}> = [
  {
    key: "orientation",
    title: "Orientation and Chart Review",
    estimate: "30-45 min per person",
    description:
      "Learn the interface, inspect the teaching patients, and identify where structured data and narrative notes disagree.",
  },
  {
    key: "controlled_experiments",
    title: "Controlled Experiments",
    estimate: "2-3 hours per person",
    description:
      "Run model, context, RAG, and temperature comparisons while changing one variable at a time.",
  },
  {
    key: "practice_benchmark",
    title: "Practice Benchmark",
    estimate: "45-60 min per person",
    description:
      "Use the public practice pack to learn how benchmark evidence, safety, and bias/equity scoring work.",
  },
  {
    key: "checkpoint_benchmark",
    title: "Checkpoint Benchmark",
    estimate: "45-60 min per person",
    description:
      "Prepare for the March 24 checkpoint with a mixed hidden and safety pack.",
  },
  {
    key: "final_benchmark",
    title: "Final Benchmark and Leaderboard",
    estimate: "60-90 min per person",
    description:
      "Submit the strongest frozen configuration against the final evaluation pack.",
  },
  {
    key: "final_reflection",
    title: "Demo and Reflection",
    estimate: "60-90 min per person",
    description:
      "Present the team’s best configuration, evidence, cost/observability findings, and governance recommendations.",
  },
] as const;

export const COURSE_DELIVERABLES = [
  "At least three controlled comparison experiments saved in the app.",
  "A populated Team Notebook with chart evidence, cost observations, and governance notes.",
  "One checkpoint benchmark run before March 24, 2026.",
  "One final reflection covering best config, cost, bias/equity, safety, and deployment advice.",
  "A short team demo that shows the chosen workflow and evidence for the configuration decision.",
] as const;

export const EXPERIMENT_RECIPES = [
  {
    id: "model-tradeoff",
    title: "Model Tradeoff",
    variableFocus: "Model size and reasoning style",
    prompt:
      "Summarize the highest-risk clinical issue in this chart and support it with chart evidence.",
  },
  {
    id: "temperature-variance",
    title: "Temperature Variance",
    variableFocus: "Determinism versus variability",
    prompt:
      "What is the safest next step for this patient today, and what evidence supports it?",
  },
  {
    id: "rag-specificity",
    title: "RAG Specificity",
    variableFocus: "Guideline grounding",
    prompt:
      "What guideline-based recommendation applies right now, and how certain is the answer?",
  },
  {
    id: "minimum-necessary-context",
    title: "Minimum Necessary Context",
    variableFocus: "Privacy versus performance",
    prompt:
      "What context level is truly necessary to answer this request safely and accurately?",
  },
] as const;

export const BENCHMARK_PACKS = [
  {
    id: "practice",
    title: "Practice Pack",
    description:
      "Visible prompts and immediate feedback for learning the workflow.",
    caseCount: 6,
  },
  {
    id: "checkpoint",
    title: "Checkpoint Pack",
    description:
      "Mixed hidden and safety cases for the March 24 progress check.",
    caseCount: 10,
  },
  {
    id: "final",
    title: "Final Pack",
    description:
      "Full evaluation pack mixing hidden clinical, safety, and bias/equity cases.",
    caseCount: 20,
  },
] as const;
