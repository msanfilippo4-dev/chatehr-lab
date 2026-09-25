/**
 * Claim scrubber and denial reference for the revenue-cycle simulation.
 * Rules are simplified teaching versions of common payer edits.
 */
import type { Claim } from "../types";

export type ScrubRuleId = "MISSING_DX_POINTER" | "MOD25_DOCUMENTATION" | "ELIGIBILITY_INACTIVE" | "REFERRAL_MISSING" | "PRIOR_AUTH_MISSING";

export interface ScrubEdit {
  rule: ScrubRuleId;
  severity: "Error" | "Warning";
  line?: number;
  message: string;
  fix: string;
}

const EM_CODES = /^99(2\d\d|3\d\d|4\d\d)$/;
const PRIMARY_CARE = ["Internal Medicine", "Family Medicine"];

export function isEmCode(cpt: string): boolean {
  return EM_CODES.test(cpt);
}

/** Run every scrubber rule against a claim. An empty list means the claim is clean. */
export function scrubClaim(claim: Claim): ScrubEdit[] {
  const edits: ScrubEdit[] = [];
  for (const line of claim.lines) {
    if (!line.dxPointers.length) {
      edits.push({
        rule: "MISSING_DX_POINTER",
        severity: "Error",
        line: line.line,
        message: `Line ${line.line} (${line.cpt} ${line.description}) has no diagnosis pointer, so medical necessity cannot be established.`,
        fix: "Point the line to the diagnosis that justified the service.",
      });
    }
  }
  const hasProcedure = claim.lines.some((line) => !isEmCode(line.cpt) && !/^36415$/.test(line.cpt) && !/^8\d{4}$/.test(line.cpt));
  for (const line of claim.lines) {
    if (isEmCode(line.cpt) && line.modifiers.includes("25") && hasProcedure && !claim.separateEmDocumented) {
      edits.push({
        rule: "MOD25_DOCUMENTATION",
        severity: "Error",
        line: line.line,
        message: `Line ${line.line}: modifier 25 claims a significant, separately identifiable E/M service on the same day as a procedure, but no supporting documentation is linked.`,
        fix: "Link the note section that documents the separate problem, or remove the E/M line if the visit was only for the procedure.",
      });
    }
  }
  if (claim.eligibility !== "Active") {
    edits.push({
      rule: "ELIGIBILITY_INACTIVE",
      severity: "Error",
      message: `Eligibility is ${claim.eligibility.toLowerCase()} for ${claim.payer} on the date of service (${claim.dos}).`,
      fix: "Re-verify coverage for the date of service and update the payer or member ID before submitting.",
    });
  }
  const specialist = !PRIMARY_CARE.includes(claim.department) && claim.lines.some((line) => isEmCode(line.cpt));
  if (claim.requiresReferral && specialist && !claim.referralNumber) {
    edits.push({
      rule: "REFERRAL_MISSING",
      severity: "Error",
      message: `${claim.payer} requires a PCP referral on file for specialist visits; none is attached.`,
      fix: "Attach the referral number from the referral record (or obtain one from the PCP office).",
    });
  }
  if (claim.requiresPriorAuth && !claim.priorAuthNumber) {
    edits.push({
      rule: "PRIOR_AUTH_MISSING",
      severity: "Error",
      message: `${claim.payer} requires prior authorization for this service; no authorization number is on the claim.`,
      fix: "Attach the authorization number, or hold the claim while authorization is requested.",
    });
  }
  return edits;
}

export function claimTotal(claim: Claim): number {
  return claim.lines.reduce((sum, line) => sum + line.charge * line.units, 0);
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Plain-language reference for the claim adjustment reason codes used in the simulation. */
export const DENIAL_REFERENCE: Record<string, { title: string; plain: string; typicalFix: string }> = {
  "CO-16": {
    title: "Claim lacks information needed for adjudication",
    plain: "Something required is missing or invalid (for example a diagnosis pointer, ordering provider, or NPI). The payer did not say the service was wrong, only that the claim is incomplete.",
    typicalFix: "Find the missing element, fix the root cause in the build or workflow, and send a corrected claim.",
  },
  "CO-197": {
    title: "Precertification/authorization absent",
    plain: "The plan required prior authorization for this service and none was on file.",
    typicalFix: "Check whether an authorization exists; if not, request a retro-authorization or appeal with medical-necessity documentation.",
  },
  "CO-97": {
    title: "Payment included in another service",
    plain: "The payer bundled this service into another line on the same claim.",
    typicalFix: "Review NCCI edits; add a modifier only if documentation supports a distinct service.",
  },
};

export const DENIAL_ACTIONS = [
  "Correct and resubmit as a corrected claim",
  "Appeal with documentation",
  "Request retro-authorization",
  "Write off as contractual adjustment",
  "Transfer balance to patient",
] as const;

/** CO (contractual obligation) denials cannot be billed to the patient. */
export function denialActionProblem(group: string, action: string): string | null {
  if (group === "CO" && action === "Transfer balance to patient") {
    return "CO means contractual obligation: the contract prohibits billing the patient for this denial.";
  }
  return null;
}
