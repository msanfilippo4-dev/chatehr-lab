import type { AlertRule, LabExample, MedicationExample, MessageCategory, RoutingRule } from "../config/types";

export const medicationExamples: MedicationExample[] = [
  { id: "MED-AMOX", name: "Amoxicillin 500 mg capsule", sig: "Take one capsule three times daily for 7 days", drugClass: "Penicillin antibiotic", teachingNote: "Triggers the allergy rule when the chart lists a penicillin allergy." },
  { id: "MED-AZI", name: "Azithromycin 250 mg tablet", sig: "Two tablets on day 1, then one tablet daily for 4 days", drugClass: "Macrolide antibiotic", teachingNote: "A common alternative when penicillin is contraindicated." },
  { id: "MED-LIS", name: "Lisinopril 10 mg tablet", sig: "Take one tablet daily", drugClass: "ACE inhibitor", teachingNote: "Raises potassium in some patients; pairs with the hyperkalemia result." },
  { id: "MED-MET", name: "Metformin 500 mg tablet", sig: "Take one tablet twice daily with meals", drugClass: "Biguanide", teachingNote: "Ties to the A1c cohort and the Z79.84 status code." },
  { id: "MED-NAP", name: "Naproxen 500 mg tablet", sig: "Take one tablet twice daily with food for 5 days", drugClass: "NSAID", teachingNote: "Appears in the HIE inbox as an external short-course medication." },
];

export const labExamples: LabExample[] = [
  { id: "LAB-BMP", name: "Basic metabolic panel", specimen: "Serum", sampleResult: "Potassium 5.9 mmol/L · High", flag: "High", teachingNote: "The abnormal result that must be acknowledged and then acted on with an owned follow-up task." },
  { id: "LAB-A1C", name: "Hemoglobin A1c", specimen: "Whole blood", sampleResult: "8.4% · High", flag: "High", teachingNote: "Feeds the population cohort and the CPT 83036 example." },
  { id: "LAB-CBC", name: "Complete blood count", specimen: "Whole blood", sampleResult: "Within reference range", flag: "", teachingNote: "A normal result still requires acknowledgment." },
];

export const alertRules: AlertRule[] = [
  { id: "ALR-PCN", kind: "allergy", orderPattern: "amoxicillin|penicillin|ampicillin", allergenPattern: "penicillin", severity: "Critical", message: "Documented penicillin allergy. Verify the reaction and choose an alternative unless a documented clinical reason supports an override.", requiresOverrideReason: true },
  { id: "ALR-DUP", kind: "duplicate", orderPattern: ".*", severity: "Warning", message: "An active order with the same name already exists for this patient.", requiresOverrideReason: false },
  { id: "ALR-K", kind: "interaction", orderPattern: "lisinopril|spironolactone", severity: "Warning", message: "Recent potassium is high. Confirm the plan addresses the hyperkalemia risk before continuing.", requiresOverrideReason: true },
];

export const messageCategories: MessageCategory[] = [
  { id: "CAT-CLIN", name: "Clinical question", description: "Symptoms, results, or medication questions that need a clinician." },
  { id: "CAT-SCHED", name: "Scheduling", description: "Appointment requests, changes, and access needs such as interpreters." },
  { id: "CAT-RX", name: "Refill request", description: "Medication renewals routed to the refill pool." },
  { id: "CAT-REC", name: "Record correction", description: "Patient reports that something in the record is wrong or missing." },
];

export const routingRules: RoutingRule[] = [
  { categoryId: "CAT-CLIN", keywordPattern: "blood pressure|reading|pain|symptom|result|medicine", routeTo: "Clinical team pool", priority: "Same day" },
  { categoryId: "CAT-SCHED", keywordPattern: "appointment|reschedule|interpreter|evening", routeTo: "Front desk pool", priority: "Routine" },
  { categoryId: "CAT-RX", keywordPattern: "refill|renew", routeTo: "Refill pool", priority: "Routine" },
  { categoryId: "CAT-REC", keywordPattern: "incorrect|missing|wrong|not mine", routeTo: "HIM record integrity", priority: "Routine" },
];
