/**
 * 4 West inpatient seed: MAR orders, the medication drawer (with deliberate
 * wrong-dose and look-alike items), wristbands on the unit, administration
 * history, and flowsheet rows for Sofia Petrov (PT-008) and James O'Brien (PT-005).
 */
import type { DrawerItem, FlowsheetEntry, MarAdministration, MarOrder, WristbandOption } from "../types";

export const marOrders: MarOrder[] = [
  // Sofia Petrov · community-acquired pneumonia · 4 West 415-A
  { id: "MAR-008-1", patientId: "PT-008", drug: "Metoprolol tartrate 25 mg tablet", drugKey: "metoprolol tartrate", doseMg: 25, doseLabel: "25 mg", route: "PO", frequency: "BID", times: ["09:00", "21:00"], parameters: "Hold for HR < 55 or SBP < 100", orderedBy: "Dr. Ana Morales" },
  { id: "MAR-008-2", patientId: "PT-008", drug: "Ceftriaxone 1 g IV piggyback", drugKey: "ceftriaxone", doseMg: 1000, doseLabel: "1 g", route: "IV", frequency: "Every 24 h", times: ["10:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-008-3", patientId: "PT-008", drug: "Azithromycin 500 mg tablet", drugKey: "azithromycin", doseMg: 500, doseLabel: "500 mg", route: "PO", frequency: "Daily", times: ["10:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-008-4", patientId: "PT-008", drug: "Apixaban 5 mg tablet", drugKey: "apixaban", doseMg: 5, doseLabel: "5 mg", route: "PO", frequency: "BID", times: ["09:00", "21:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-008-5", patientId: "PT-008", drug: "Acetaminophen 650 mg by mouth", drugKey: "acetaminophen", doseMg: 650, doseLabel: "650 mg", route: "PO", frequency: "Every 6 h PRN", times: [], prn: { indication: "Pain or temperature > 38.0 °C (max 3 g/day)", minHoursBetween: 6, requiresPainScore: true }, orderedBy: "Dr. Ana Morales" },
  // James O'Brien · acute on chronic systolic heart failure · 4 West 412-B
  { id: "MAR-005-1", patientId: "PT-005", drug: "Furosemide 40 mg IV push", drugKey: "furosemide", doseMg: 40, doseLabel: "40 mg", route: "IV", frequency: "BID", times: ["09:00", "17:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-005-2", patientId: "PT-005", drug: "Carvedilol 12.5 mg tablet", drugKey: "carvedilol", doseMg: 12.5, doseLabel: "12.5 mg", route: "PO", frequency: "BID with food", times: ["09:00", "21:00"], parameters: "Hold for HR < 55 or SBP < 90", orderedBy: "Dr. Ana Morales" },
  { id: "MAR-005-3", patientId: "PT-005", drug: "HydrALAZINE 25 mg tablet", drugKey: "hydralazine", doseMg: 25, doseLabel: "25 mg", route: "PO", frequency: "Every 8 h", times: ["02:00", "10:00", "18:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-005-4", patientId: "PT-005", drug: "Empagliflozin 10 mg tablet", drugKey: "empagliflozin", doseMg: 10, doseLabel: "10 mg", route: "PO", frequency: "Daily", times: ["09:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-005-5", patientId: "PT-005", drug: "Heparin 5,000 units subcutaneous", drugKey: "heparin", doseMg: 5000, doseLabel: "5,000 units", route: "SC", frequency: "Every 8 h", times: ["06:00", "14:00", "22:00"], orderedBy: "Dr. Ana Morales" },
  { id: "MAR-005-6", patientId: "PT-005", drug: "Insulin lispro 4 units subcutaneous with meals", drugKey: "insulin lispro", doseMg: 4, doseLabel: "4 units + correction scale", route: "SC", frequency: "With meals", times: ["07:30", "11:30", "16:30"], orderedBy: "Dr. Ana Morales", notes: "Check fingerstick glucose within 30 minutes before the dose." },
  { id: "MAR-005-7", patientId: "PT-005", drug: "Atorvastatin 40 mg tablet", drugKey: "atorvastatin", doseMg: 40, doseLabel: "40 mg", route: "PO", frequency: "Nightly", times: ["21:00"], orderedBy: "Dr. Ana Morales" },
];

export const drawerItems: DrawerItem[] = [
  { id: "DRW-008-1", patientId: "PT-008", label: "Metoprolol tartrate 50 mg tablet (unit dose)", drugKey: "metoprolol tartrate", strengthMg: 50, route: "PO", barcode: "SIM-0008-5001", pitfall: "wrong-dose" },
  { id: "DRW-008-2", patientId: "PT-008", label: "Metoprolol succinate ER 25 mg tablet", drugKey: "metoprolol succinate", strengthMg: 25, route: "PO", barcode: "SIM-0008-5002", pitfall: "look-alike" },
  { id: "DRW-008-3", patientId: "PT-008", label: "Ceftriaxone 1 g in 50 mL IV piggyback", drugKey: "ceftriaxone", strengthMg: 1000, route: "IV", barcode: "SIM-0008-5003" },
  { id: "DRW-008-4", patientId: "PT-008", label: "Azithromycin 500 mg tablet", drugKey: "azithromycin", strengthMg: 500, route: "PO", barcode: "SIM-0008-5004" },
  { id: "DRW-008-5", patientId: "PT-008", label: "Apixaban 5 mg tablet", drugKey: "apixaban", strengthMg: 5, route: "PO", barcode: "SIM-0008-5005" },
  { id: "DRW-008-6", patientId: "PT-008", label: "Acetaminophen 650 mg (2 × 325 mg unit-dose pack)", drugKey: "acetaminophen", strengthMg: 650, route: "PO", barcode: "SIM-0008-5006" },
  { id: "DRW-005-1", patientId: "PT-005", label: "Furosemide 40 mg/4 mL vial", drugKey: "furosemide", strengthMg: 40, route: "IV", barcode: "SIM-0005-4001" },
  { id: "DRW-005-2", patientId: "PT-005", label: "Carvedilol 12.5 mg tablet", drugKey: "carvedilol", strengthMg: 12.5, route: "PO", barcode: "SIM-0005-4002" },
  { id: "DRW-005-3", patientId: "PT-005", label: "Carvedilol 6.25 mg tablet", drugKey: "carvedilol", strengthMg: 6.25, route: "PO", barcode: "SIM-0005-4003", pitfall: "wrong-dose" },
  { id: "DRW-005-4", patientId: "PT-005", label: "HydrALAZINE 25 mg tablet", drugKey: "hydralazine", strengthMg: 25, route: "PO", barcode: "SIM-0005-4004" },
  { id: "DRW-005-5", patientId: "PT-005", label: "HydrOXYzine 25 mg tablet", drugKey: "hydroxyzine", strengthMg: 25, route: "PO", barcode: "SIM-0005-4005", pitfall: "look-alike" },
  { id: "DRW-005-6", patientId: "PT-005", label: "Empagliflozin 10 mg tablet", drugKey: "empagliflozin", strengthMg: 10, route: "PO", barcode: "SIM-0005-4006" },
  { id: "DRW-005-7", patientId: "PT-005", label: "Heparin 5,000 units/mL vial", drugKey: "heparin", strengthMg: 5000, route: "SC", barcode: "SIM-0005-4007" },
  { id: "DRW-005-8", patientId: "PT-005", label: "Insulin lispro pen (4-unit dose)", drugKey: "insulin lispro", strengthMg: 4, route: "SC", barcode: "SIM-0005-4008" },
];

/** Wristbands a nurse could scan on 4 West, including a roommate with a similar name. */
export const unitWristbands: WristbandOption[] = [
  { id: "WB-PT-008", label: "Sofia Petrov · Rm 415-A", mrn: "6105107", dob: "1947-12-09" },
  { id: "WB-ROOMMATE", label: "Sofia Petrova · Rm 415-B", mrn: "6105188", dob: "1947-12-19" },
  { id: "WB-PT-005", label: "James O'Brien · Rm 412-B", mrn: "6105104", dob: "1959-05-08" },
];

export const marAdministrations: MarAdministration[] = [
  // History behind Jordan Park's ticket: the drawer stocks 50 mg tablets for a 25 mg order.
  { id: "MADM-H1", orderId: "MAR-008-1", patientId: "PT-008", slot: "21:00", date: "2026-09-19", outcome: "Given with override", recordedAt: "2026-09-19T21:18:00-04:00", simTime: "21:18", performer: "Nina Alvarez, RN", itemId: "DRW-008-1", wristbandMrn: "6105107", warnings: ["DOSE MISMATCH. Scanned 50 mg; ordered 25 mg."], reason: "Pharmacy sent 50 mg tablets; gave half a tablet.", seeded: true },
  { id: "MADM-H2", orderId: "MAR-008-1", patientId: "PT-008", slot: "09:00", date: "2026-09-20", outcome: "Given with override", recordedAt: "2026-09-20T09:12:00-04:00", simTime: "09:12", performer: "Rosa Lin, RN", itemId: "DRW-008-1", wristbandMrn: "6105107", warnings: ["DOSE MISMATCH. Scanned 50 mg; ordered 25 mg."], reason: "Only 50 mg in the drawer; split tablet.", seeded: true },
  { id: "MADM-H3", orderId: "MAR-008-1", patientId: "PT-008", slot: "21:00", date: "2026-09-20", outcome: "Given with override", recordedAt: "2026-09-20T21:40:00-04:00", simTime: "21:40", performer: "Nina Alvarez, RN", itemId: "DRW-008-1", wristbandMrn: "6105107", warnings: ["DOSE MISMATCH. Scanned 50 mg; ordered 25 mg."], reason: "Same as last night; scanner always flags this one.", seeded: true },
  // Today (simulated clock 10:15)
  { id: "MADM-T1", orderId: "MAR-008-4", patientId: "PT-008", slot: "09:00", outcome: "Given", recordedAt: "2026-09-21T08:58:00-04:00", simTime: "08:58", performer: "Rosa Lin, RN", itemId: "DRW-008-5", wristbandMrn: "6105107", seeded: true },
  { id: "MADM-T2", orderId: "MAR-008-5", patientId: "PT-008", slot: "PRN", outcome: "Given", recordedAt: "2026-09-21T04:10:00-04:00", simTime: "04:10", performer: "Nina Alvarez, RN", itemId: "DRW-008-6", wristbandMrn: "6105107", painScore: 5, seeded: true },
  { id: "MADM-T3", orderId: "MAR-005-1", patientId: "PT-005", slot: "09:00", outcome: "Given", recordedAt: "2026-09-21T09:02:00-04:00", simTime: "09:02", performer: "Kevin Osei, RN", itemId: "DRW-005-1", wristbandMrn: "6105104", seeded: true },
  { id: "MADM-T4", orderId: "MAR-005-2", patientId: "PT-005", slot: "09:00", outcome: "Given", recordedAt: "2026-09-21T09:05:00-04:00", simTime: "09:05", performer: "Kevin Osei, RN", itemId: "DRW-005-2", wristbandMrn: "6105104", seeded: true },
  { id: "MADM-T5", orderId: "MAR-005-3", patientId: "PT-005", slot: "02:00", outcome: "Given", recordedAt: "2026-09-21T02:06:00-04:00", simTime: "02:06", performer: "Nina Alvarez, RN", itemId: "DRW-005-4", wristbandMrn: "6105104", seeded: true },
  { id: "MADM-T6", orderId: "MAR-005-5", patientId: "PT-005", slot: "06:00", outcome: "Given", recordedAt: "2026-09-21T06:04:00-04:00", simTime: "06:04", performer: "Nina Alvarez, RN", itemId: "DRW-005-7", wristbandMrn: "6105104", seeded: true },
  { id: "MADM-T7", orderId: "MAR-005-6", patientId: "PT-005", slot: "07:30", outcome: "Given", recordedAt: "2026-09-21T07:41:00-04:00", simTime: "07:41", performer: "Kevin Osei, RN", itemId: "DRW-005-8", wristbandMrn: "6105104", seeded: true },
];

function entry(partial: Omit<FlowsheetEntry, "recordedBy" | "seeded"> & { recordedBy?: string }): FlowsheetEntry {
  return { recordedBy: "Nina Alvarez, RN", seeded: true, ...partial };
}

export const flowsheets: FlowsheetEntry[] = [
  entry({ id: "FS-008-1", patientId: "PT-008", time: "2026-09-20T12:00", temp: 37.2, hr: 84, sbp: 134, dbp: 78, rr: 18, spo2: 96, onOxygen: false, consciousness: "Alert", pain: 2, intake: 480, output: 350, fallRiskReassessed: true, recordedBy: "Rosa Lin, RN" }),
  entry({ id: "FS-008-2", patientId: "PT-008", time: "2026-09-20T16:00", temp: 37.6, hr: 90, sbp: 130, dbp: 74, rr: 20, spo2: 95, onOxygen: false, consciousness: "Alert", pain: 3, intake: 240, output: 200, recordedBy: "Rosa Lin, RN" }),
  entry({ id: "FS-008-3", patientId: "PT-008", time: "2026-09-20T20:00", temp: 37.9, hr: 96, sbp: 126, dbp: 72, rr: 20, spo2: 95, onOxygen: false, consciousness: "Alert", pain: 3, intake: 120, output: 150, fallRiskReassessed: true }),
  entry({ id: "FS-008-4", patientId: "PT-008", time: "2026-09-21T00:00", temp: 38.0, hr: 98, sbp: 120, dbp: 70, rr: 21, spo2: 95, onOxygen: false, consciousness: "Alert", pain: 4, intake: 0, output: 100 }),
  entry({ id: "FS-008-5", patientId: "PT-008", time: "2026-09-21T04:00", temp: 38.1, hr: 100, sbp: 116, dbp: 66, rr: 20, spo2: 94, onOxygen: false, consciousness: "Alert", pain: 5, intake: 120, output: 90 }),
  entry({ id: "FS-008-6", patientId: "PT-008", time: "2026-09-21T08:00", temp: 38.0, hr: 96, sbp: 118, dbp: 66, rr: 21, spo2: 95, onOxygen: false, consciousness: "Alert", pain: 3, intake: 200, output: 120, recordedBy: "Rosa Lin, RN" }),
  entry({ id: "FS-005-1", patientId: "PT-005", time: "2026-09-20T20:00", temp: 36.8, hr: 98, sbp: 158, dbp: 92, rr: 24, spo2: 95, onOxygen: true, consciousness: "Alert", pain: 0, intake: 240, output: 900, fallRiskReassessed: true }),
  entry({ id: "FS-005-2", patientId: "PT-005", time: "2026-09-21T00:00", temp: 36.7, hr: 92, sbp: 148, dbp: 88, rr: 22, spo2: 95, onOxygen: true, consciousness: "Alert", pain: 0, intake: 120, output: 650 }),
  entry({ id: "FS-005-3", patientId: "PT-005", time: "2026-09-21T04:00", temp: 36.8, hr: 90, sbp: 142, dbp: 86, rr: 20, spo2: 96, onOxygen: true, consciousness: "Alert", pain: 1, intake: 0, output: 400 }),
  entry({ id: "FS-005-4", patientId: "PT-005", time: "2026-09-21T08:00", temp: 36.9, hr: 88, sbp: 138, dbp: 84, rr: 20, spo2: 94, onOxygen: false, consciousness: "Alert", pain: 1, intake: 360, output: 550, fallRiskReassessed: true, recordedBy: "Kevin Osei, RN" }),
];

/** Values from the bedside monitor at 10:10, used by the "Pull monitor values" button. */
export const bedsideMonitor: Record<string, Partial<FlowsheetEntry>> = {
  "PT-008": { temp: 38.7, hr: 118, sbp: 96, dbp: 58, rr: 26, spo2: 91, onOxygen: false, consciousness: "New confusion", pain: 4 },
  "PT-005": { temp: 36.8, hr: 86, sbp: 134, dbp: 82, rr: 18, spo2: 95, onOxygen: false, consciousness: "Alert", pain: 1 },
};

/** Patients with suspected or confirmed infection (drives the sepsis screen). */
export const suspectedInfection: Record<string, boolean> = { "PT-008": true, "PT-005": false };

export const INPATIENT_IDS = ["PT-008", "PT-005"];
