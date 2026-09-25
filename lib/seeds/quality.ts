/**
 * Unit-level operational data used by the Analytics view and two practice tickets.
 * Synthetic aggregates for 4 West (32 beds) and the ambulatory clinics.
 */

export interface FallWeek {
  week: string;
  eligiblePatientDays: number;
  /** Reassessments documented in the retired row FS-1180. */
  oldRow: number;
  /** Reassessments documented in the new row FS-2203 (live from 9/14). */
  newRow: number;
}

export const fallReassessment: FallWeek[] = [
  { week: "Aug 24", eligiblePatientDays: 196, oldRow: 171, newRow: 0 },
  { week: "Aug 31", eligiblePatientDays: 204, oldRow: 180, newRow: 0 },
  { week: "Sep 7", eligiblePatientDays: 201, oldRow: 173, newRow: 0 },
  { week: "Sep 14", eligiblePatientDays: 210, oldRow: 128, newRow: 61 },
  { week: "Sep 21 (partial)", eligiblePatientDays: 88, oldRow: 51, newRow: 29 },
];

export const FALL_REPORT_DEFINITION = "Numerator: patient-days with a fall-risk reassessment documented in flowsheet row FS-1180 within 24 hours. Denominator: 4 West patient-days with Morse score ≥ 45 on admission.";

export interface AlertStat {
  rule: string;
  alert: string;
  fired: number;
  overriddenPct: number;
  latestValueNormalPct?: number;
  note: string;
}

export const alertStats: AlertStat[] = [
  { rule: "ALR-K", alert: "High potassium with lisinopril or spironolactone", fired: 412, overriddenPct: 97, latestValueNormalPct: 81, note: "Condition: any potassium result ever flagged High. No lookback window, no threshold, interruptive for all prescribers." },
  { rule: "ALR-DUP", alert: "Duplicate order", fired: 1204, overriddenPct: 94, note: "Fires on any same-name order, including completed ones." },
  { rule: "ALR-PCN", alert: "Penicillin allergy", fired: 38, overriddenPct: 21, note: "Specific trigger; low override rate." },
  { rule: "BPA-SEPSIS", alert: "Inpatient sepsis screen (EWS ≥ 5)", fired: 57, overriddenPct: 18, note: "Nurse-facing; drives rapid response." },
];
