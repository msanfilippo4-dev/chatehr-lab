/**
 * Barcode medication administration (BCMA) logic for the eMAR simulation.
 * Pure functions so the five-rights rules can be unit tested.
 */
import type { DrawerItem, MarAdministration, MarOrder, Patient, WristbandOption } from "../types";

/** Simulated wall-clock time on SIMULATION_DATE (the eMAR "now"). */
export const SIM_CLOCK = "10:15";

/** The simulated day (matches SIMULATION_DATE in lib/seed.ts). Administrations without a date are on this day. */
export const SIM_DAY = "2026-09-21";

/** Only administrations recorded on the simulated day count toward today's MAR slots. */
export function onSimDay(record: Pick<MarAdministration, "date">): boolean {
  return (record.date ?? SIM_DAY) === SIM_DAY;
}

/** Doses given more than this many minutes after the scheduled time are late. */
export const LATE_WINDOW_MINUTES = 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type SlotState = "Given" | "Given late" | "Held" | "Override" | "Overdue" | "Due" | "Future";

export function slotState(order: MarOrder, slot: string, administrations: MarAdministration[], now = SIM_CLOCK): SlotState {
  const record = administrations.find((item) => item.orderId === order.id && item.slot === slot && onSimDay(item));
  if (record) {
    if (record.outcome === "Held") return "Held";
    if (record.outcome === "Given with override") return "Override";
    return record.late ? "Given late" : "Given";
  }
  const diff = toMinutes(now) - toMinutes(slot);
  if (diff > LATE_WINDOW_MINUTES) return "Overdue";
  if (diff >= -LATE_WINDOW_MINUTES) return "Due";
  return "Future";
}

export type RightName = "Patient" | "Medication" | "Dose" | "Route" | "Time" | "Allergy";

export interface RightCheck {
  right: RightName;
  ok: boolean;
  /** "stop" cannot be overridden; "warning" requires a documented override reason. */
  severity: "ok" | "warning" | "stop";
  message: string;
}

export interface FiveRightsResult {
  checks: RightCheck[];
  /** A hard stop (wrong patient or wrong drug): rescan before anything else. */
  blocking: boolean;
  /** At least one warning: administering requires an override reason. */
  needsOverride: boolean;
  late: boolean;
  warnings: string[];
}

const PENICILLIN_KEYS = ["amoxicillin", "ampicillin", "penicillin", "piperacillin-tazobactam", "amoxicillin-clavulanate"];
const SULFA_KEYS = ["sulfamethoxazole-trimethoprim"];

function allergyConflict(order: MarOrder, patient: Patient): string | null {
  const allergens = patient.allergies.filter((item) => item.type !== "Intolerance").map((item) => item.allergen.toLowerCase());
  if (allergens.some((a) => a.includes("penicillin")) && PENICILLIN_KEYS.includes(order.drugKey)) return "Documented penicillin allergy";
  if (allergens.some((a) => a.includes("sulfa")) && SULFA_KEYS.includes(order.drugKey)) return "Documented sulfonamide allergy";
  return null;
}

function looksAlike(a: string, b: string): boolean {
  const first = (value: string) => value.split(/[\s-]/)[0];
  return first(a) === first(b) || a.slice(0, 4) === b.slice(0, 4);
}

export function fiveRightsCheck(input: {
  order: MarOrder;
  slot: string;
  patient: Patient;
  wristband: WristbandOption;
  item: DrawerItem;
  administrations: MarAdministration[];
  now?: string;
}): FiveRightsResult {
  const { order, slot, patient, wristband, item, administrations } = input;
  const now = input.now ?? SIM_CLOCK;
  const checks: RightCheck[] = [];

  const rightPatient = wristband.mrn === patient.mrn;
  checks.push(rightPatient
    ? { right: "Patient", ok: true, severity: "ok", message: `Wristband matches ${patient.name} · MRN ${patient.mrn}.` }
    : { right: "Patient", ok: false, severity: "stop", message: `WRONG PATIENT. Wristband is ${wristband.label} (MRN ${wristband.mrn}); the open MAR belongs to ${patient.name} (MRN ${patient.mrn}). Stop and rescan the correct wristband.` });

  const rightDrug = item.drugKey === order.drugKey;
  if (rightDrug) {
    checks.push({ right: "Medication", ok: true, severity: "ok", message: `${item.label} matches the order.` });
  } else {
    const lasa = looksAlike(item.drugKey, order.drugKey);
    checks.push({
      right: "Medication",
      ok: false,
      severity: "stop",
      message: lasa
        ? `LOOK-ALIKE DRUG. Scanned ${item.label}; the order is ${order.drug}. These names look or sound alike. Return the item and rescan.`
        : `WRONG MEDICATION. Scanned ${item.label}; the order is ${order.drug}. Return the item and rescan.`,
    });
  }

  if (rightDrug) {
    const rightDose = item.strengthMg === order.doseMg;
    checks.push(rightDose
      ? { right: "Dose", ok: true, severity: "ok", message: `${item.strengthMg} mg matches the ordered ${order.doseLabel}.` }
      : { right: "Dose", ok: false, severity: "warning", message: `DOSE MISMATCH. Scanned ${item.strengthMg} mg; ordered ${order.doseLabel}. Do not split or substitute without a pharmacy-verified product. Hold and notify pharmacy, or document an override reason.` });
    const rightRoute = item.route === order.route;
    checks.push(rightRoute
      ? { right: "Route", ok: true, severity: "ok", message: `Route ${order.route} matches.` }
      : { right: "Route", ok: false, severity: "warning", message: `Route mismatch: item is ${item.route}; order is ${order.route}.` });
  }

  let late = false;
  if (slot === "PRN" && order.prn) {
    const last = administrations
      .filter((record) => record.orderId === order.id && record.outcome !== "Held" && onSimDay(record))
      .sort((a, b) => toMinutes(b.simTime) - toMinutes(a.simTime))[0];
    const since = last ? toMinutes(now) - toMinutes(last.simTime) : Infinity;
    checks.push(since < order.prn.minHoursBetween * 60
      ? { right: "Time", ok: false, severity: "warning", message: `Too soon: last PRN dose at ${last?.simTime}; minimum interval is ${order.prn.minHoursBetween} hours.` }
      : { right: "Time", ok: true, severity: "ok", message: `PRN interval respected (minimum ${order.prn.minHoursBetween} h).` });
  } else {
    const diff = toMinutes(now) - toMinutes(slot);
    if (diff > LATE_WINDOW_MINUTES) {
      late = true;
      checks.push({ right: "Time", ok: false, severity: "warning", message: `LATE: scheduled ${slot}, now ${now} (${diff} minutes). The dose will be flagged late; document why.` });
    } else if (diff < -LATE_WINDOW_MINUTES) {
      checks.push({ right: "Time", ok: false, severity: "warning", message: `EARLY: scheduled ${slot}; it is ${now}. Give within 60 minutes of the scheduled time.` });
    } else {
      checks.push({ right: "Time", ok: true, severity: "ok", message: `Within the administration window for ${slot}.` });
    }
  }

  const conflict = allergyConflict(order, patient);
  checks.push(conflict
    ? { right: "Allergy", ok: false, severity: "warning", message: `${conflict}. Verify with the prescriber before administering.` }
    : { right: "Allergy", ok: true, severity: "ok", message: "No documented allergy conflict." });

  const blocking = checks.some((check) => check.severity === "stop");
  const warnings = checks.filter((check) => !check.ok).map((check) => check.message);
  return { checks, blocking, needsOverride: !blocking && checks.some((check) => check.severity === "warning"), late, warnings };
}

export const HOLD_REASONS = [
  "Wrong strength dispensed; pharmacy notified",
  "Parameter not met (HR or BP below hold parameter)",
  "Patient refused after education",
  "Patient off unit / NPO for procedure",
  "Held per provider order",
] as const;

export const OVERRIDE_REASONS = [
  "Pharmacy-verified substitute product",
  "Provider at bedside approved (verbal order to follow)",
  "Late dose: patient off unit at scheduled time",
  "Other (explain)",
] as const;
