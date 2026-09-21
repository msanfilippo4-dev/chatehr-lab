import type { CodeEntry } from "../config/types";

const ICD_SOURCE = "CDC/NCHS ICD-10-CM FY2027 release (effective October 1, 2026)";
const CPT_SOURCE = "CPT is maintained and copyrighted by the American Medical Association; descriptions here are plain-language teaching summaries, not official descriptors.";

export const icd10Catalog: CodeEntry[] = [
  { system: "ICD-10-CM", code: "M75.51", display: "Bursitis of right shoulder", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "Laterality is part of the code. A left-shoulder draft that carries this code is internally inconsistent." },
  { system: "ICD-10-CM", code: "I10", display: "Essential (primary) hypertension", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "A three-character category that is complete on its own; no further specificity is required." },
  { system: "ICD-10-CM", code: "E11.9", display: "Type 2 diabetes mellitus without complications", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "Use only when the record documents no complication; otherwise a more specific E11 code applies." },
  { system: "ICD-10-CM", code: "E11.65", display: "Type 2 diabetes mellitus with hyperglycemia", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "Contrast with E11.9 when an elevated A1c is documented as poorly controlled by the clinician." },
  { system: "ICD-10-CM", code: "J45.20", display: "Mild intermittent asthma, uncomplicated", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "Severity and control are both encoded; the chart must support each." },
  { system: "ICD-10-CM", code: "Z79.84", display: "Long term (current) use of oral hypoglycemic drugs", use: "Status / context", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "A status code that describes context, not a disease. It is never a principal diagnosis." },
  { system: "ICD-10-CM", code: "Z88.0", display: "Allergy status to penicillin", use: "Status / context", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "Documents an allergy history; decision support usually reads the allergy list, not this code." },
  { system: "ICD-10-CM", code: "E87.5", display: "Hyperkalemia", use: "Diagnosis / condition", version: "FY2027", effectiveDate: "2026-10-01", status: "active", source: ICD_SOURCE, teachingNote: "A laboratory flag alone does not justify this code; the clinician must document the condition." },
];

export const cptCatalog: CodeEntry[] = [
  { system: "CPT", code: "99213", display: "Established patient office visit, low complexity", use: "Procedure / service", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "Evaluation and management levels depend on documented medical decision making or time, not on the diagnosis." },
  { system: "CPT", code: "99214", display: "Established patient office visit, moderate complexity", use: "Procedure / service", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "Compare with 99213 to show how documentation drives service level." },
  { system: "CPT", code: "99203", display: "New patient office visit, low complexity", use: "Procedure / service", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "New versus established status is defined by prior services within three years, which the EHR can check." },
  { system: "CPT", code: "83036", display: "Hemoglobin A1c measurement", use: "Laboratory procedure", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "The service performed, not the reason for it. The reason is the ICD-10-CM code." },
  { system: "CPT", code: "80048", display: "Basic metabolic panel", use: "Laboratory procedure", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "A panel code; the potassium result in this course comes from this panel." },
  { system: "CPT", code: "36415", display: "Collection of venous blood by venipuncture", use: "Procedure / service", version: "CPT 2026", effectiveDate: "2026-01-01", status: "example", source: CPT_SOURCE, teachingNote: "A small, common service that shows why one visit can carry several CPT codes." },
];
