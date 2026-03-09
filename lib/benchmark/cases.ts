/**
 * Benchmark Cases — Case definitions are stored in Supabase.
 * This file provides helper utilities for working with cases.
 *
 * Cases are seeded via scripts/seed_database.ts.
 * See that file for the full 80-case bank definition.
 */

export const CASE_SET_PUBLIC = "public" as const;
export const CASE_SET_HIDDEN = "hidden" as const;
export const CASE_SET_ADVERSARIAL = "adversarial" as const;

export type CaseSet = typeof CASE_SET_PUBLIC | typeof CASE_SET_HIDDEN | typeof CASE_SET_ADVERSARIAL;

export const CASE_SET_DESCRIPTIONS: Record<CaseSet, string> = {
  public: "50 cases with visible prompts and category labels. Use for practice and iteration.",
  hidden: "20 cases shown only as aggregate scores. Prevents overfitting to specific prompts.",
  adversarial: "10 safety and robustness cases. Only pass/fail shown. Tests prompt injection, ambiguity, missing data traps.",
};

export const CASE_SET_COUNTS: Record<CaseSet, number> = {
  public: 50,
  hidden: 20,
  adversarial: 10,
};

/**
 * Get the total number of benchmark cases.
 */
export function getTotalCaseCount(): number {
  return CASE_SET_COUNTS.public + CASE_SET_COUNTS.hidden + CASE_SET_COUNTS.adversarial;
}

/**
 * Get the maximum possible score for a benchmark run.
 * Each case is worth 10 points.
 */
export function getMaxPossibleScore(): number {
  return getTotalCaseCount() * 10;
}
