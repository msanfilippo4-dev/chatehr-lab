import { SIMULATION_DATE } from "./seed";
import type { Patient, PatientResult } from "./types";

/** Age in whole years on the simulated date. */
export function ageOn(dob: string, on = SIMULATION_DATE): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [cy, cm, cd] = on.split("-").map(Number);
  if (!y || !cy) return 0;
  return cy - y - (cm < m || (cm === m && cd < d) ? 1 : 0);
}

export function initials(name: string): string {
  return name
    .replace(/[^A-Za-z' .-]/g, "")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDob(dob: string): string {
  const [y, m, d] = dob.split("-");
  return y && m && d ? `${m}/${d}/${y}` : dob;
}

export function sexLabel(sex: string): string {
  if (/^f/i.test(sex)) return "F";
  if (/^m/i.test(sex)) return "M";
  return sex || "—";
}

export function realAllergies(patient: Patient) {
  return patient.allergies.filter((item) => item.allergen && !/no known|not yet reviewed/i.test(item.allergen));
}

export function allergySummary(patient: Patient): { text: string; tone: "danger" | "good" | "neutral" } {
  const list = realAllergies(patient);
  if (list.length) {
    return { text: `Allergies: ${list.map((item) => `${item.allergen.replace(/ \(.*\)/, "")}${item.reaction ? ` (${item.reaction.toLowerCase()})` : ""}`).join(", ")}`, tone: "danger" };
  }
  if (patient.allergies.some((item) => /not yet reviewed/i.test(item.allergen))) return { text: "Allergies not reviewed", tone: "neutral" };
  return { text: "NKDA", tone: "good" };
}

export function resultValue(result: PatientResult): string {
  if (!result.value) return result.status === "Pending" ? "Pending" : "—";
  if (!result.unit || result.value.includes(result.unit)) return result.value;
  return `${result.value} ${result.unit}`;
}

export function isAbnormal(result: PatientResult): boolean {
  return Boolean(result.flag) && !/^normal$/i.test(result.flag);
}
