/**
 * Simplified early warning score, modeled on the Royal College of Physicians NEWS2
 * (SpO2 scale 1 only). Teaching approximation: it is not a validated clinical tool.
 */
import type { FlowsheetEntry } from "../types";

export type EwsRisk = "Low" | "Low-medium" | "Medium" | "High";

export interface EwsParameterScore {
  parameter: string;
  value: string;
  points: number;
}

export interface EwsResult {
  total: number;
  risk: EwsRisk;
  parameters: EwsParameterScore[];
  /** True when at least one parameter scored 3 (a "red" single parameter). */
  singleRed: boolean;
  /** Parameters that could not be scored because they were not documented. */
  missing: string[];
  response: string;
}

type Vitals = Pick<FlowsheetEntry, "rr" | "spo2" | "onOxygen" | "sbp" | "hr" | "consciousness" | "temp">;

export function scoreRespiratoryRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

export function scoreSpo2(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

export function scoreSystolic(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

export function scoreHeartRate(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

export function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

export function computeEws(vitals: Vitals): EwsResult {
  const parameters: EwsParameterScore[] = [];
  const missing: string[] = [];
  const add = (parameter: string, value: number | undefined, unit: string, scorer: (v: number) => number) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      missing.push(parameter);
      return;
    }
    parameters.push({ parameter, value: `${value}${unit}`, points: scorer(value) });
  };
  add("Respiratory rate", vitals.rr, "/min", scoreRespiratoryRate);
  add("SpO2", vitals.spo2, "%", scoreSpo2);
  parameters.push({ parameter: "Supplemental oxygen", value: vitals.onOxygen ? "Yes" : "Room air", points: vitals.onOxygen ? 2 : 0 });
  add("Systolic BP", vitals.sbp, " mmHg", scoreSystolic);
  add("Heart rate", vitals.hr, "/min", scoreHeartRate);
  if (vitals.consciousness) {
    parameters.push({ parameter: "Consciousness", value: vitals.consciousness, points: vitals.consciousness === "Alert" ? 0 : 3 });
  } else {
    missing.push("Consciousness");
  }
  add("Temperature", vitals.temp, " °C", scoreTemperature);

  const total = parameters.reduce((sum, item) => sum + item.points, 0);
  const singleRed = parameters.some((item) => item.points === 3);
  const risk: EwsRisk = total >= 7 ? "High" : total >= 5 ? "Medium" : singleRed ? "Low-medium" : "Low";
  return { total, risk, parameters, singleRed, missing, response: ewsResponse(risk) };
}

export function ewsResponse(risk: EwsRisk): string {
  switch (risk) {
    case "High":
      return "Emergency response: call the rapid response team now and notify the provider; continuous monitoring.";
    case "Medium":
      return "Urgent response: notify the provider and charge nurse within 30 minutes; vitals at least hourly.";
    case "Low-medium":
      return "A single parameter is in the red range: notify the charge nurse and reassess within 1 hour.";
    default:
      return "Continue routine monitoring (at least every 4–6 hours).";
  }
}

export interface SepsisScreen {
  positive: boolean;
  criteria: string[];
}

/** Simplified SIRS-based nurse sepsis screen used after a medium or high EWS. */
export function sepsisScreen(vitals: Vitals, suspectedInfection: boolean): SepsisScreen {
  const criteria: string[] = [];
  if (vitals.temp !== undefined && (vitals.temp > 38.3 || vitals.temp < 36)) criteria.push(`Temperature ${vitals.temp} °C`);
  if (vitals.hr !== undefined && vitals.hr > 90) criteria.push(`Heart rate ${vitals.hr}/min`);
  if (vitals.rr !== undefined && vitals.rr > 20) criteria.push(`Respiratory rate ${vitals.rr}/min`);
  if (vitals.consciousness && vitals.consciousness !== "Alert") criteria.push(`Altered mental status (${vitals.consciousness})`);
  if (vitals.sbp !== undefined && vitals.sbp <= 100) criteria.push(`Systolic BP ${vitals.sbp} mmHg`);
  return { positive: suspectedInfection && criteria.length >= 2, criteria };
}

export function ewsTone(risk: EwsRisk): "good" | "warn" | "danger" {
  if (risk === "High" || risk === "Medium") return "danger";
  if (risk === "Low-medium") return "warn";
  return "good";
}
