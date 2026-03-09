// ---------------------------------------------------------------------------
// generate_patients.ts
// Generates 5,000 synthetic patients for ChartEHR Project (Supabase seed)
//
// Usage:  npx tsx scripts/generate_patients.ts
// Output: scripts/output/patients.json
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { teachingPatients } from "./data/teaching-content";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NUM_PATIENTS = 5000;
const NUM_COMPLEX = 200;
const PATIENT_SEED = Number.parseInt(process.env.PATIENT_SEED || "61172026", 10);
const REFERENCE_DATE = new Date(
  process.env.PATIENT_REFERENCE_DATE || "2026-01-15T00:00:00Z"
);
const REFERENCE_YEAR = REFERENCE_DATE.getUTCFullYear();

// ---------------------------------------------------------------------------
// Seeded RNG (same LCG as chatehr-lab)
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = createRng(PATIENT_SEED);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function getRandomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)];
}
function getRandom(min: number, max: number): number {
  return random() * (max - min) + min;
}
function getRandomInt(min: number, max: number): number {
  return Math.floor(getRandom(min, max + 1));
}
function getRandomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()))
    .toISOString()
    .split("T")[0];
}
function pickWeighted<T extends { w: number }>(items: T[]): T {
  const draw = random();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.w;
    if (draw < cumulative) return item;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Name pools
// ---------------------------------------------------------------------------

const firstNamesMale = [
  "James","John","Robert","Michael","William","David","Richard","Joseph","Thomas",
  "Charles","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven",
  "Paul","Andrew","Joshua","Kevin","Brian","Edward","Ronald","Timothy","Jason",
  "Jeffrey","Ryan","Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry",
  "Justin","Scott","Brandon","Raymond","Gregory","Samuel","Frank","Alexander",
  "Patrick","Benjamin","Jack","Dennis","Jerry","Tyler","Aaron",
];
const firstNamesFemale = [
  "Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica",
  "Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Kimberly",
  "Emily","Donna","Michelle","Carol","Amanda","Dorothy","Melissa","Deborah",
  "Stephanie","Rebecca","Sharon","Laura","Cynthia","Kathleen","Amy","Angela",
  "Shirley","Anna","Brenda","Pamela","Emma","Nicole","Helen","Samantha",
  "Katherine","Christine","Debra","Rachel","Carolyn","Janet","Catherine","Maria",
  "Heather",
];
const lastNames = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
  "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
  "Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White",
  "Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young",
  "Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green",
  "Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
];

const providers = [
  "Dr. Sarah Chen","Dr. Marcus Williams","Dr. Priya Patel","Dr. James O'Brien",
  "Dr. Fatima Al-Hassan","Dr. Robert Kim","Dr. Lisa Thompson","Dr. David Nguyen",
  "Dr. Maria Rodriguez","Dr. John Smith","Dr. Emily Johnson","Dr. Michael Brown",
  "Dr. Anita Gupta","Dr. Charles Lee","Dr. Keisha Washington",
];

const nurseAuthors = [
  "RN J. Martinez","RN K. Patel","RN T. Okafor","RN S. Reyes","RN A. Kim",
  "RN L. Johnson","RN M. Davis",
];

// ---------------------------------------------------------------------------
// Demographic pools & distributions
// ---------------------------------------------------------------------------

const raceDistribution = [
  { value: "White", w: 0.30 },
  { value: "Black or African American", w: 0.30 },
  { value: "Hispanic or Latino", w: 0.25 },
  { value: "Asian", w: 0.10 },
  { value: "Other", w: 0.05 },
] as const;

const ethnicityByRace: Record<string, string[]> = {
  "White": ["Not Hispanic or Latino"],
  "Black or African American": ["Not Hispanic or Latino"],
  "Hispanic or Latino": ["Hispanic or Latino"],
  "Asian": ["Not Hispanic or Latino"],
  "Other": ["Not Hispanic or Latino", "Hispanic or Latino"],
};

const languageByRace: Record<string, { value: string; w: number }[]> = {
  "White": [{ value: "English", w: 0.95 }, { value: "Spanish", w: 0.05 }],
  "Black or African American": [{ value: "English", w: 0.95 }, { value: "French Creole", w: 0.05 }],
  "Hispanic or Latino": [{ value: "English", w: 0.55 }, { value: "Spanish", w: 0.45 }],
  "Asian": [{ value: "English", w: 0.60 }, { value: "Mandarin", w: 0.15 }, { value: "Cantonese", w: 0.10 }, { value: "Korean", w: 0.10 }, { value: "Bengali", w: 0.05 }],
  "Other": [{ value: "English", w: 0.80 }, { value: "Spanish", w: 0.10 }, { value: "Arabic", w: 0.10 }],
};

const maritalStatusOptions = [
  { value: "Single", w: 0.30 },
  { value: "Married", w: 0.40 },
  { value: "Divorced", w: 0.15 },
  { value: "Widowed", w: 0.10 },
  { value: "Separated", w: 0.05 },
] as const;

const insuranceDistribution = [
  { value: "Medicare", w: 0.40 },
  { value: "Medicaid", w: 0.30 },
  { value: "Private", w: 0.20 },
  { value: "Uninsured", w: 0.10 },
] as const;

const bronxZips = [
  "10451","10452","10453","10454","10455","10456","10457","10458","10459","10460",
  "10461","10462","10463","10464","10465","10466","10467","10468","10469","10470",
  "10471","10472","10473","10474","10475",
];

// ---------------------------------------------------------------------------
// Conditions (extended with COPD, AFib, DVT, Obesity, Chronic Pain)
// ---------------------------------------------------------------------------

interface ConditionDef {
  code: string;
  display: string;
}

const conditionsList: ConditionDef[] = [
  { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
  { code: "I10", display: "Essential (primary) hypertension" },
  { code: "E78.5", display: "Hyperlipidemia, unspecified" },
  { code: "J45.909", display: "Unspecified asthma, uncomplicated" },
  { code: "F32.A", display: "Depression, unspecified" },
  { code: "M54.5", display: "Low back pain" },
  { code: "K21.9", display: "Gastro-esophageal reflux disease without esophagitis" },
  { code: "E03.9", display: "Hypothyroidism, unspecified" },
  { code: "F41.1", display: "Generalized anxiety disorder" },
  { code: "M19.90", display: "Unspecified osteoarthritis, unspecified site" },
  { code: "I50.9", display: "Heart failure, unspecified" },
  { code: "N18.3", display: "Chronic kidney disease, stage 3" },
  { code: "J44.1", display: "Chronic obstructive pulmonary disease with acute exacerbation" },
  { code: "I48.91", display: "Unspecified atrial fibrillation" },
  { code: "I82.40", display: "Acute embolism and thrombosis of unspecified deep veins of lower extremity" },
  { code: "E66.01", display: "Morbid (severe) obesity due to excess calories" },
  { code: "G89.29", display: "Other chronic pain" },
];

// Multimorbidity clusters for complex patients
const complexClusters: ConditionDef[][] = [
  // Cardiometabolic cluster
  [
    { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
    { code: "I10", display: "Essential (primary) hypertension" },
    { code: "N18.3", display: "Chronic kidney disease, stage 3" },
    { code: "E78.5", display: "Hyperlipidemia, unspecified" },
    { code: "E66.01", display: "Morbid (severe) obesity due to excess calories" },
  ],
  // Heart failure cluster
  [
    { code: "I50.9", display: "Heart failure, unspecified" },
    { code: "I48.91", display: "Unspecified atrial fibrillation" },
    { code: "N18.3", display: "Chronic kidney disease, stage 3" },
    { code: "I10", display: "Essential (primary) hypertension" },
    { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
  ],
  // Respiratory + cardiac
  [
    { code: "J44.1", display: "Chronic obstructive pulmonary disease with acute exacerbation" },
    { code: "I50.9", display: "Heart failure, unspecified" },
    { code: "I10", display: "Essential (primary) hypertension" },
    { code: "E78.5", display: "Hyperlipidemia, unspecified" },
    { code: "F32.A", display: "Depression, unspecified" },
  ],
  // DVT + AFib + metabolic
  [
    { code: "I82.40", display: "Acute embolism and thrombosis of unspecified deep veins of lower extremity" },
    { code: "I48.91", display: "Unspecified atrial fibrillation" },
    { code: "I10", display: "Essential (primary) hypertension" },
    { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
    { code: "G89.29", display: "Other chronic pain" },
  ],
  // Chronic pain + depression + metabolic
  [
    { code: "G89.29", display: "Other chronic pain" },
    { code: "F32.A", display: "Depression, unspecified" },
    { code: "E66.01", display: "Morbid (severe) obesity due to excess calories" },
    { code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
    { code: "I10", display: "Essential (primary) hypertension" },
    { code: "M19.90", display: "Unspecified osteoarthritis, unspecified site" },
  ],
];

// ---------------------------------------------------------------------------
// Lab tests (extended)
// ---------------------------------------------------------------------------

interface LabTestDef {
  name: string;
  unit: string;
  min: number;
  max: number;
  normalMin?: number;
  normalMax?: number;
  referenceRange: string;
}

const labTests: LabTestDef[] = [
  { name: "Hemoglobin A1c", unit: "%", min: 4.0, max: 10.0, normalMax: 5.6, referenceRange: "4.0-5.6%" },
  { name: "Fasting Glucose", unit: "mg/dL", min: 70, max: 250, normalMax: 99, referenceRange: "70-99 mg/dL" },
  { name: "Total Cholesterol", unit: "mg/dL", min: 100, max: 320, normalMax: 199, referenceRange: "<200 mg/dL" },
  { name: "LDL Cholesterol", unit: "mg/dL", min: 50, max: 220, normalMax: 99, referenceRange: "<100 mg/dL" },
  { name: "HDL Cholesterol", unit: "mg/dL", min: 20, max: 80, normalMin: 40, referenceRange: ">40 mg/dL" },
  { name: "Triglycerides", unit: "mg/dL", min: 50, max: 500, normalMax: 150, referenceRange: "<150 mg/dL" },
  { name: "TSH", unit: "mIU/L", min: 0.1, max: 10.0, normalMin: 0.4, normalMax: 4.0, referenceRange: "0.4-4.0 mIU/L" },
  { name: "Vitamin D", unit: "ng/mL", min: 8, max: 100, normalMin: 30, referenceRange: "30-100 ng/mL" },
  { name: "Hemoglobin", unit: "g/dL", min: 9.0, max: 18.0, normalMin: 12.0, normalMax: 16.0, referenceRange: "12.0-16.0 g/dL" },
  { name: "Creatinine", unit: "mg/dL", min: 0.5, max: 4.0, normalMin: 0.6, normalMax: 1.2, referenceRange: "0.6-1.2 mg/dL" },
  { name: "BNP", unit: "pg/mL", min: 5, max: 900, normalMax: 100, referenceRange: "<100 pg/mL" },
  { name: "eGFR", unit: "mL/min/1.73m2", min: 15, max: 120, normalMin: 60, referenceRange: ">60 mL/min/1.73m2" },
  { name: "Potassium", unit: "mEq/L", min: 3.0, max: 6.0, normalMin: 3.5, normalMax: 5.0, referenceRange: "3.5-5.0 mEq/L" },
  { name: "Sodium", unit: "mEq/L", min: 130, max: 150, normalMin: 136, normalMax: 145, referenceRange: "136-145 mEq/L" },
  { name: "BUN", unit: "mg/dL", min: 5, max: 60, normalMin: 7, normalMax: 20, referenceRange: "7-20 mg/dL" },
  { name: "WBC", unit: "x10^3/uL", min: 2.5, max: 18.0, normalMin: 4.5, normalMax: 11.0, referenceRange: "4.5-11.0 x10^3/uL" },
  { name: "Platelet Count", unit: "x10^3/uL", min: 100, max: 450, normalMin: 150, normalMax: 400, referenceRange: "150-400 x10^3/uL" },
  { name: "INR", unit: "", min: 0.8, max: 4.5, normalMin: 0.9, normalMax: 1.1, referenceRange: "0.9-1.1" },
  { name: "Troponin I", unit: "ng/mL", min: 0.00, max: 0.50, normalMax: 0.04, referenceRange: "<0.04 ng/mL" },
];

// ---------------------------------------------------------------------------
// Vaccines
// ---------------------------------------------------------------------------

const vaccines = [
  { name: "Influenza, seasonal, injectable", cvx: "141" },
  { name: "COVID-19, mRNA (updated 2024)", cvx: "208" },
  { name: "Tdap", cvx: "115" },
  { name: "Zoster recombinant (Shingrix)", cvx: "187" },
  { name: "Pneumococcal conjugate PCV15", cvx: "215" },
  { name: "Hepatitis B, adult", cvx: "43" },
  { name: "RSV vaccine, adult", cvx: "300" },
];

// ---------------------------------------------------------------------------
// Medications by condition (extended for new conditions)
// ---------------------------------------------------------------------------

interface MedDef {
  name: string;
  dose: string;
  frequency: string;
  route: string;
}

const medicationsByCondition: Record<string, MedDef[]> = {
  "E11.9": [
    { name: "Metformin", dose: "1000 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Glipizide", dose: "5 mg", frequency: "Daily", route: "PO" },
    { name: "Empagliflozin", dose: "10 mg", frequency: "Daily", route: "PO" },
    { name: "Semaglutide", dose: "1 mg", frequency: "Weekly", route: "SubQ" },
    { name: "Insulin glargine", dose: "20 units", frequency: "Nightly", route: "SubQ" },
  ],
  "I10": [
    { name: "Lisinopril", dose: "10 mg", frequency: "Daily", route: "PO" },
    { name: "Amlodipine", dose: "5 mg", frequency: "Daily", route: "PO" },
    { name: "Metoprolol succinate", dose: "50 mg", frequency: "Daily", route: "PO" },
    { name: "Hydrochlorothiazide", dose: "25 mg", frequency: "Daily", route: "PO" },
    { name: "Losartan", dose: "50 mg", frequency: "Daily", route: "PO" },
  ],
  "E78.5": [
    { name: "Atorvastatin", dose: "40 mg", frequency: "Nightly", route: "PO" },
    { name: "Rosuvastatin", dose: "20 mg", frequency: "Nightly", route: "PO" },
    { name: "Ezetimibe", dose: "10 mg", frequency: "Daily", route: "PO" },
  ],
  "J45.909": [
    { name: "Albuterol inhaler", dose: "90 mcg/actuation", frequency: "PRN", route: "Inhaled" },
    { name: "Fluticasone/Salmeterol", dose: "250/50 mcg", frequency: "Twice Daily", route: "Inhaled" },
    { name: "Montelukast", dose: "10 mg", frequency: "Nightly", route: "PO" },
  ],
  "F32.A": [
    { name: "Sertraline", dose: "100 mg", frequency: "Daily", route: "PO" },
    { name: "Escitalopram", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Bupropion XL", dose: "300 mg", frequency: "Daily", route: "PO" },
  ],
  "K21.9": [
    { name: "Omeprazole", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Pantoprazole", dose: "40 mg", frequency: "Daily", route: "PO" },
  ],
  "E03.9": [
    { name: "Levothyroxine", dose: "75 mcg", frequency: "Daily", route: "PO" },
  ],
  "F41.1": [
    { name: "Buspirone", dose: "10 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Escitalopram", dose: "10 mg", frequency: "Daily", route: "PO" },
  ],
  "I50.9": [
    { name: "Carvedilol", dose: "12.5 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Furosemide", dose: "40 mg", frequency: "Daily", route: "PO" },
    { name: "Sacubitril/Valsartan", dose: "97/103 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Spironolactone", dose: "25 mg", frequency: "Daily", route: "PO" },
  ],
  "N18.3": [
    { name: "Sodium bicarbonate", dose: "650 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Sevelamer", dose: "800 mg", frequency: "Three Times Daily", route: "PO" },
  ],
  "M19.90": [
    { name: "Celecoxib", dose: "200 mg", frequency: "Daily", route: "PO" },
    { name: "Meloxicam", dose: "15 mg", frequency: "Daily", route: "PO" },
  ],
  "J44.1": [
    { name: "Tiotropium", dose: "18 mcg", frequency: "Daily", route: "Inhaled" },
    { name: "Fluticasone/Vilanterol", dose: "100/25 mcg", frequency: "Daily", route: "Inhaled" },
    { name: "Albuterol nebulizer", dose: "2.5 mg/3 mL", frequency: "Q4H PRN", route: "Nebulized" },
    { name: "Prednisone", dose: "40 mg", frequency: "Daily", route: "PO" },
  ],
  "I48.91": [
    { name: "Apixaban", dose: "5 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Rivaroxaban", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Diltiazem ER", dose: "180 mg", frequency: "Daily", route: "PO" },
    { name: "Amiodarone", dose: "200 mg", frequency: "Daily", route: "PO" },
    { name: "Digoxin", dose: "0.125 mg", frequency: "Daily", route: "PO" },
  ],
  "I82.40": [
    { name: "Warfarin", dose: "5 mg", frequency: "Daily", route: "PO" },
    { name: "Rivaroxaban", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Enoxaparin", dose: "40 mg", frequency: "Daily", route: "SubQ" },
  ],
  "E66.01": [
    { name: "Semaglutide", dose: "2.4 mg", frequency: "Weekly", route: "SubQ" },
    { name: "Phentermine/Topiramate", dose: "7.5/46 mg", frequency: "Daily", route: "PO" },
    { name: "Orlistat", dose: "120 mg", frequency: "Three Times Daily", route: "PO" },
  ],
  "G89.29": [
    { name: "Gabapentin", dose: "300 mg", frequency: "Three Times Daily", route: "PO" },
    { name: "Duloxetine", dose: "60 mg", frequency: "Daily", route: "PO" },
    { name: "Acetaminophen", dose: "500 mg", frequency: "Q6H PRN", route: "PO" },
    { name: "Capsaicin cream", dose: "0.025%", frequency: "QID", route: "Topical" },
  ],
};

const generalMeds: MedDef[] = [
  { name: "Aspirin", dose: "81 mg", frequency: "Daily", route: "PO" },
  { name: "Vitamin D3", dose: "2000 IU", frequency: "Daily", route: "PO" },
  { name: "Multivitamin", dose: "1 tablet", frequency: "Daily", route: "PO" },
  { name: "Omega-3 fatty acids", dose: "1 g", frequency: "Daily", route: "PO" },
  { name: "Calcium carbonate", dose: "500 mg", frequency: "Twice Daily", route: "PO" },
  { name: "Ferrous sulfate", dose: "325 mg", frequency: "Daily", route: "PO" },
  { name: "Melatonin", dose: "3 mg", frequency: "Nightly", route: "PO" },
];

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------

const allergyData = [
  { allergen: "Penicillin", reaction: "Rash", severity: "Moderate" },
  { allergen: "Sulfa drugs", reaction: "Hives", severity: "Moderate" },
  { allergen: "Aspirin", reaction: "GI upset", severity: "Mild" },
  { allergen: "NSAIDs", reaction: "Bronchospasm", severity: "Severe/Anaphylaxis" },
  { allergen: "Latex", reaction: "Contact dermatitis", severity: "Mild" },
  { allergen: "Shellfish", reaction: "Anaphylaxis", severity: "Severe/Anaphylaxis" },
  { allergen: "Tree nuts", reaction: "Throat swelling", severity: "Severe/Anaphylaxis" },
  { allergen: "Codeine", reaction: "Nausea/vomiting", severity: "Mild" },
  { allergen: "Contrast dye", reaction: "Flushing, rash", severity: "Moderate" },
  { allergen: "ACE inhibitors", reaction: "Cough", severity: "Mild" },
  { allergen: "Amoxicillin", reaction: "Rash", severity: "Moderate" },
  { allergen: "Morphine", reaction: "Pruritus", severity: "Mild" },
  { allergen: "Ibuprofen", reaction: "GI bleeding", severity: "Moderate" },
  { allergen: "Metformin", reaction: "GI upset", severity: "Mild" },
  { allergen: "Peanuts", reaction: "Anaphylaxis", severity: "Severe/Anaphylaxis" },
];

// ---------------------------------------------------------------------------
// Chief complaints & encounter visit types
// ---------------------------------------------------------------------------

const chiefComplaints = [
  "Follow-up for chronic disease management",
  "Routine annual physical exam",
  "Blood pressure check",
  "Worsening shortness of breath",
  "Fatigue and generalized weakness",
  "Lower extremity edema",
  "Medication refill request",
  "Lab result review",
  "New onset headaches",
  "Poorly controlled blood glucose",
  "Weight gain concern",
  "Joint pain and stiffness",
  "Cough and URI symptoms",
  "Abdominal pain",
  "Follow-up after ED visit",
  "Post-hospitalization visit",
  "Dizziness and lightheadedness",
  "Annual wellness visit",
  "Chest pain, exertional",
  "Medication side effect concern",
  "Palpitations and irregular heartbeat",
  "Chronic pain management",
  "Difficulty breathing at night",
  "Skin rash evaluation",
  "Numbness and tingling in extremities",
];

const visitTypeWeights = [
  { type: "Office Visit", w: 0.50 },
  { type: "Telehealth", w: 0.20 },
  { type: "ED Visit", w: 0.15 },
  { type: "Hospital Admission", w: 0.10 },
  { type: "Urgent Care", w: 0.05 },
];

// ---------------------------------------------------------------------------
// Imaging templates
// ---------------------------------------------------------------------------

interface ImagingTemplate {
  type: string;
  findings: { finding: string; impression: string }[];
}

const imagingTemplates: ImagingTemplate[] = [
  {
    type: "Chest X-Ray",
    findings: [
      { finding: "No acute cardiopulmonary process. Heart size normal. Lungs clear bilaterally.", impression: "Normal chest radiograph." },
      { finding: "Mild cardiomegaly noted. No pleural effusion. Clear lung fields.", impression: "Mild cardiomegaly, no acute findings." },
      { finding: "Bilateral basilar atelectasis. No pneumothorax. Heart size upper limits of normal.", impression: "Minor bibasilar atelectasis, likely positional. No acute disease." },
      { finding: "Left lower lobe opacity concerning for pneumonia vs atelectasis. No pleural effusion.", impression: "Left lower lobe infiltrate; correlate clinically for pneumonia." },
      { finding: "Increased interstitial markings bilaterally. Mild pulmonary vascular congestion. Heart size mildly enlarged.", impression: "Findings consistent with mild congestive heart failure." },
    ],
  },
  {
    type: "ECG (12-lead)",
    findings: [
      { finding: "Normal sinus rhythm at 72 bpm. Normal axis. No ST-T wave changes.", impression: "Normal ECG." },
      { finding: "Sinus tachycardia at 108 bpm. Left ventricular hypertrophy by voltage criteria. Nonspecific ST-T changes.", impression: "Sinus tachycardia with LVH; correlate with echocardiogram." },
      { finding: "Irregularly irregular rhythm consistent with atrial fibrillation. Ventricular rate 88 bpm. No acute ST changes.", impression: "Atrial fibrillation with controlled ventricular rate." },
      { finding: "Normal sinus rhythm. First-degree AV block (PR 220ms). Left axis deviation.", impression: "First-degree AV block with left axis deviation; consider cardiology referral if symptomatic." },
      { finding: "Normal sinus rhythm at 65 bpm. T-wave inversions in leads V4-V6.", impression: "Nonspecific T-wave changes; correlate with troponin and clinical presentation." },
    ],
  },
  {
    type: "CT Chest",
    findings: [
      { finding: "No pulmonary embolism on CTA. No significant lymphadenopathy. Mild emphysematous changes noted.", impression: "No PE. Mild emphysema." },
      { finding: "Ground-glass opacities in bilateral lower lobes. No pleural effusion. Mediastinal structures normal.", impression: "Bilateral ground-glass opacities; differential includes atypical infection, inflammatory process." },
      { finding: "Scattered subcentimeter pulmonary nodules (largest 4mm in RLL). No consolidation.", impression: "Small pulmonary nodules, likely benign. Follow-up CT in 12 months per Fleischner criteria." },
    ],
  },
  {
    type: "CT Abdomen/Pelvis",
    findings: [
      { finding: "No acute intra-abdominal pathology. Liver and kidneys normal. No free fluid.", impression: "Normal CT abdomen and pelvis." },
      { finding: "Hepatic steatosis noted. Kidneys show bilateral cortical thinning. No hydronephrosis.", impression: "Fatty liver disease and bilateral renal cortical thinning consistent with chronic kidney disease." },
      { finding: "Cholelithiasis without evidence of cholecystitis. No biliary dilation.", impression: "Gallstones without acute cholecystitis." },
    ],
  },
  {
    type: "MRI Brain",
    findings: [
      { finding: "No acute intracranial abnormality. No mass, hemorrhage, or midline shift. Age-appropriate white matter changes.", impression: "No acute intracranial pathology. Age-appropriate small vessel ischemic changes." },
      { finding: "Mild periventricular white matter hyperintensities on FLAIR. No restricted diffusion.", impression: "Chronic small vessel ischemic disease. No acute infarct." },
    ],
  },
  {
    type: "Echocardiogram",
    findings: [
      { finding: "Normal LV systolic function, LVEF 55-60%. No significant valvular disease. Normal chamber sizes.", impression: "Normal echocardiogram." },
      { finding: "Reduced LVEF at 35%. Moderate mitral regurgitation. LV dilation. Mild diastolic dysfunction.", impression: "Reduced LVEF with moderate MR; consistent with dilated cardiomyopathy." },
      { finding: "Preserved LVEF 55%. Grade II diastolic dysfunction. Mild LVH. Trace tricuspid regurgitation.", impression: "Diastolic dysfunction with mild LVH; correlate with hypertensive heart disease." },
      { finding: "LVEF 40-45%. Mild global hypokinesis. Mild aortic stenosis. No pericardial effusion.", impression: "Mildly reduced LVEF with mild aortic stenosis." },
    ],
  },
  {
    type: "Renal Ultrasound",
    findings: [
      { finding: "Kidneys normal in size bilaterally (right 10.5 cm, left 10.8 cm). No hydronephrosis or stones.", impression: "Normal renal ultrasound." },
      { finding: "Bilateral renal cortical thinning with increased echogenicity. Right kidney 9.2 cm, left 9.0 cm. No hydronephrosis.", impression: "Findings consistent with chronic kidney disease. No obstruction." },
    ],
  },
  {
    type: "Lower Extremity Doppler Ultrasound",
    findings: [
      { finding: "No evidence of deep vein thrombosis in bilateral lower extremities. All deep veins compressible with normal flow.", impression: "No DVT identified." },
      { finding: "Acute thrombus identified in left popliteal vein extending to distal femoral vein. Right lower extremity negative for DVT.", impression: "Acute left lower extremity DVT involving popliteal and distal femoral veins. Anticoagulation recommended." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Social history pools
// ---------------------------------------------------------------------------

const housingOptions = [
  { value: "Stable housing", w: 0.60 },
  { value: "Lives with family", w: 0.20 },
  { value: "Assisted living", w: 0.05 },
  { value: "Shelter/Transitional", w: 0.08 },
  { value: "Homeless", w: 0.04 },
  { value: "Unknown", w: 0.03 },
];

const employmentOptions = [
  { value: "Employed full-time", w: 0.30 },
  { value: "Employed part-time", w: 0.15 },
  { value: "Retired", w: 0.25 },
  { value: "Disabled", w: 0.10 },
  { value: "Unemployed", w: 0.12 },
  { value: "Student", w: 0.05 },
  { value: "Unknown", w: 0.03 },
];

const foodSecurityOptions = [
  { value: "Food secure", w: 0.65 },
  { value: "Low food security", w: 0.20 },
  { value: "Very low food security", w: 0.10 },
  { value: "Unknown", w: 0.05 },
];

const educationOptions = [
  { value: "Less than high school", w: 0.15 },
  { value: "High school diploma/GED", w: 0.30 },
  { value: "Some college", w: 0.20 },
  { value: "Associate degree", w: 0.10 },
  { value: "Bachelor's degree", w: 0.15 },
  { value: "Graduate degree", w: 0.07 },
  { value: "Unknown", w: 0.03 },
];

const tobaccoOptions = [
  { value: "Never smoker", w: 0.50 },
  { value: "Former smoker", w: 0.25 },
  { value: "Current everyday smoker", w: 0.12 },
  { value: "Current some day smoker", w: 0.08 },
  { value: "Unknown", w: 0.05 },
];

const alcoholOptions = [
  { value: "None", w: 0.35 },
  { value: "Social (1-2 drinks/week)", w: 0.30 },
  { value: "Moderate (3-7 drinks/week)", w: 0.18 },
  { value: "Heavy (>7 drinks/week)", w: 0.10 },
  { value: "Unknown", w: 0.07 },
];

// ---------------------------------------------------------------------------
// Clinical note templates
// ---------------------------------------------------------------------------

const noteTypes = ["progress", "discharge", "consult", "nursing"] as const;

function generateClinicalNoteContent(
  noteType: string,
  age: number,
  gender: string,
  conditionCodes: Set<string>,
  provider: string
): string {
  const g = gender.toLowerCase();
  const hasDM = conditionCodes.has("E11.9");
  const hasHTN = conditionCodes.has("I10");
  const hasHF = conditionCodes.has("I50.9");
  const hasCOPD = conditionCodes.has("J44.1");
  const hasAFib = conditionCodes.has("I48.91");
  const hasCKD = conditionCodes.has("N18.3");

  switch (noteType) {
    case "progress": {
      if (hasDM && hasHTN) {
        return `Progress Note - ${provider}\n${age}-year-old ${g} with T2DM and HTN presenting for routine follow-up. Patient reports overall stable glucose readings on home monitor, range 130-190 mg/dL. Reports occasional headaches, denies chest pain, dyspnea, or visual changes. Current medications reviewed and reconciled. BP elevated today; will uptitrate antihypertensive. HbA1c due for recheck. Discussed dietary modifications and exercise goals. Patient verbalized understanding and agreement with plan. Follow-up in 3 months.`;
      }
      if (hasHF) {
        return `Progress Note - ${provider}\n${age}-year-old ${g} with HFrEF presenting for heart failure management follow-up. Patient reports stable weight with daily monitoring, no increase >2 lbs. Denies orthopnea, PND, or worsening dyspnea. Functional class NYHA II-III, able to perform ADLs with mild limitation. Exam: lungs clear, trace pedal edema, JVP normal. Current GDMT optimized. Continue salt restriction <2g/day. Echocardiogram scheduled for interval assessment. Return in 6 weeks.`;
      }
      if (hasCOPD) {
        return `Progress Note - ${provider}\n${age}-year-old ${g} with COPD (GOLD stage II-III) presenting for follow-up. Patient reports 1-2 exacerbations over past 6 months. Currently using maintenance inhalers as prescribed. Denies hemoptysis. Oxygen saturations stable at rest. Pulmonary function testing shows stable FEV1. Smoking cessation counseling provided; patient reports continued abstinence (or ongoing use). Flu vaccine administered. Pulmonary rehab discussed. Follow-up in 3 months.`;
      }
      return `Progress Note - ${provider}\n${age}-year-old ${g} presenting for routine follow-up. No acute complaints. Chronic conditions stable on current regimen. Vital signs within acceptable limits today. Physical exam unremarkable. Preventive care measures reviewed. Medication reconciliation performed; all medications continued without changes. Patient educated on maintaining healthy lifestyle. Will return in 6-12 months for routine follow-up.`;
    }
    case "discharge": {
      if (hasHF) {
        return `Discharge Summary - ${provider}\nAdmission Diagnosis: Acute decompensated heart failure\nHospital Course: ${age}-year-old ${g} admitted with worsening dyspnea and bilateral lower extremity edema. BNP significantly elevated. Started on IV diuresis with furosemide, converted to PO on day 2 with excellent diuretic response. Net negative 4L over 3-day admission. Weight at discharge down 3.5 kg from admission. Electrolytes monitored and repleted as needed.\nDischarge Medications: Updated medication list provided. Furosemide increased to 60mg daily. All other HF medications continued.\nDischarge Instructions: Daily weights, 2L fluid restriction, <2g sodium diet. Return to ED if weight gain >2 lbs/day or worsening dyspnea. Follow-up with cardiology in 7 days, PCP in 14 days.`;
      }
      if (hasCOPD) {
        return `Discharge Summary - ${provider}\nAdmission Diagnosis: COPD exacerbation\nHospital Course: ${age}-year-old ${g} admitted with acute COPD exacerbation, presenting with increased dyspnea, productive cough with purulent sputum. Started on nebulized bronchodilators, systemic corticosteroids (prednisone 40mg), and azithromycin. O2 requirements peaked at 3L NC on day 1, weaned to room air by day 3. Sputum culture showed normal flora.\nDischarge Medications: Prednisone taper (40mg x 2 days, 20mg x 2 days, 10mg x 1 day). Continue maintenance inhalers. Albuterol PRN.\nDischarge Instructions: Smoking cessation critical. Return for worsening dyspnea or fever. Pulmonology follow-up in 2 weeks.`;
      }
      return `Discharge Summary - ${provider}\nAdmission Diagnosis: Observation for chest pain, ruled out ACS\nHospital Course: ${age}-year-old ${g} admitted for evaluation of atypical chest pain. Serial troponins negative x3. ECG without ischemic changes. Telemetry monitoring without significant arrhythmia. Patient remained hemodynamically stable throughout admission. Pain attributed to musculoskeletal etiology.\nDischarge Medications: Continue home medications without changes. Ibuprofen 400mg TID PRN for chest wall pain.\nDischarge Instructions: Return for recurrent chest pain, dyspnea, or syncope. Follow-up with PCP in 1 week. Stress test scheduled as outpatient.`;
    }
    case "consult": {
      if (hasCKD) {
        return `Nephrology Consultation - ${provider}\nReason for Consult: Chronic kidney disease management\nFindings: ${age}-year-old ${g} with CKD stage 3 (eGFR 30-45). Contributing factors include ${hasDM ? "diabetic nephropathy" : "hypertensive nephrosclerosis"}${hasHTN ? " and chronic hypertension" : ""}. Urine albumin-to-creatinine ratio elevated. Renal ultrasound shows bilateral cortical thinning.\nRecommendations:\n- Continue ACE-I/ARB for renoprotection; monitor potassium and creatinine in 2 weeks\n- Consider SGLT2 inhibitor for CKD progression reduction\n- Avoid nephrotoxins (NSAIDs, contrast if possible)\n- Monitor calcium, phosphorus, PTH; start vitamin D supplementation\n- Dietary protein restriction (0.8 g/kg/day) discussed with patient\n- Follow-up in nephrology clinic in 3 months`;
      }
      if (hasAFib) {
        return `Cardiology/Electrophysiology Consultation - ${provider}\nReason for Consult: Atrial fibrillation management\nFindings: ${age}-year-old ${g} with paroxysmal/persistent atrial fibrillation. CHA2DS2-VASc score calculated. Echocardiogram shows ${hasHF ? "reduced LVEF, dilated LA" : "preserved LVEF, mildly dilated LA"}.\nRecommendations:\n- Anticoagulation with DOAC (apixaban 5mg BID) based on stroke risk\n- Rate control with ${hasHF ? "metoprolol" : "diltiazem ER"}\n- Consider rhythm control strategy if symptomatic despite rate control\n- TSH to rule out hyperthyroidism\n- Discuss cardioversion timing if persistent AF\n- Follow-up in EP clinic in 4-6 weeks`;
      }
      return `General Internal Medicine Consultation - ${provider}\nReason for Consult: Preoperative medical clearance\nFindings: ${age}-year-old ${g} evaluated for surgical risk assessment. Reviewed medical history, medications, and recent labs. Cardiac risk assessment performed using RCRI; low-intermediate risk. No contraindications to planned procedure.\nRecommendations:\n- Continue all home medications through morning of surgery (except anticoagulants per surgical team)\n- No additional cardiac testing indicated based on functional capacity and risk score\n- Perioperative glucose management plan provided (if diabetic)\n- Clear to proceed with planned procedure from medical standpoint`;
    }
    case "nursing": {
      return `Nursing Assessment - ${getRandomItem(nurseAuthors)}\nPatient: ${age}-year-old ${g}. Alert and oriented x4. ${hasHF ? "Daily weight obtained: compliant with 2L fluid restriction. Assessed for peripheral edema — trace bilateral ankle edema noted." : "Ambulating independently. No distress observed."} Vital signs assessed and documented. ${hasDM ? "Blood glucose checked: fasting value recorded. Insulin administered per sliding scale as ordered." : ""} Medications administered per orders without adverse reaction. ${hasCOPD ? "Respiratory assessment: using accessory muscles mildly, SpO2 94% on room air. Nebulizer treatment administered with improvement." : "Respiratory effort unlabored, lungs clear on auscultation."} Fall risk assessment completed — ${age >= 65 ? "moderate risk; fall precautions in place" : "low risk"}. Pain level assessed: ${conditionCodes.has("G89.29") ? "reports 5/10 chronic pain, managed per pain protocol" : "reports 0-2/10, no intervention needed"}. Patient education provided on medication compliance and follow-up appointments. Call bell within reach.`;
    }
    default:
      return `Clinical note for ${age}-year-old ${g}. Routine documentation. No acute concerns.`;
  }
}

// ---------------------------------------------------------------------------
// Order templates for encounters
// ---------------------------------------------------------------------------

interface OrderDef {
  type: string;
  description: string;
  status: string;
}

function generateOrders(conditionCodes: Set<string>): OrderDef[] {
  const orders: OrderDef[] = [];
  const pool: OrderDef[] = [];

  // General orders
  pool.push(
    { type: "Lab", description: "Comprehensive Metabolic Panel", status: "Completed" },
    { type: "Lab", description: "Complete Blood Count with Differential", status: "Completed" },
    { type: "Lab", description: "Urinalysis", status: "Completed" },
  );

  if (conditionCodes.has("E11.9")) {
    pool.push(
      { type: "Lab", description: "Hemoglobin A1c", status: "Completed" },
      { type: "Lab", description: "Fasting Glucose", status: "Completed" },
      { type: "Referral", description: "Ophthalmology - Diabetic Eye Exam", status: "Pending" },
      { type: "Education", description: "Diabetes Self-Management Education", status: "Completed" },
    );
  }
  if (conditionCodes.has("I10")) {
    pool.push(
      { type: "Lab", description: "Basic Metabolic Panel", status: "Completed" },
      { type: "Education", description: "DASH Diet Counseling", status: "Completed" },
    );
  }
  if (conditionCodes.has("E78.5")) {
    pool.push(
      { type: "Lab", description: "Lipid Panel", status: "Completed" },
    );
  }
  if (conditionCodes.has("I50.9")) {
    pool.push(
      { type: "Lab", description: "BNP/NT-proBNP", status: "Completed" },
      { type: "Imaging", description: "Echocardiogram", status: "Scheduled" },
      { type: "Referral", description: "Cardiology Follow-up", status: "Pending" },
    );
  }
  if (conditionCodes.has("N18.3")) {
    pool.push(
      { type: "Lab", description: "Renal Function Panel", status: "Completed" },
      { type: "Lab", description: "Urine Albumin-to-Creatinine Ratio", status: "Completed" },
      { type: "Referral", description: "Nephrology Consultation", status: "Pending" },
    );
  }
  if (conditionCodes.has("J44.1")) {
    pool.push(
      { type: "Lab", description: "ABG (Arterial Blood Gas)", status: "Completed" },
      { type: "Imaging", description: "Chest X-Ray", status: "Completed" },
      { type: "Referral", description: "Pulmonary Rehabilitation", status: "Pending" },
    );
  }
  if (conditionCodes.has("I48.91")) {
    pool.push(
      { type: "Lab", description: "TSH", status: "Completed" },
      { type: "Lab", description: "INR/PT", status: "Completed" },
      { type: "Imaging", description: "ECG (12-lead)", status: "Completed" },
    );
  }
  if (conditionCodes.has("I82.40")) {
    pool.push(
      { type: "Lab", description: "D-Dimer", status: "Completed" },
      { type: "Lab", description: "INR/PT", status: "Completed" },
      { type: "Imaging", description: "Lower Extremity Doppler Ultrasound", status: "Completed" },
    );
  }

  // Pick 1-4 orders from the pool
  const numOrders = Math.min(getRandomInt(1, 4), pool.length);
  const usedDescriptions = new Set<string>();
  for (let i = 0; i < numOrders; i++) {
    let order: OrderDef;
    let attempts = 0;
    do {
      order = getRandomItem(pool);
      attempts++;
    } while (usedDescriptions.has(order.description) && attempts < 20);
    if (!usedDescriptions.has(order.description)) {
      usedDescriptions.add(order.description);
      // Randomize status slightly
      const statusRoll = random();
      const status = statusRoll < 0.6 ? "Completed" : statusRoll < 0.85 ? "Pending" : "Scheduled";
      orders.push({ ...order, status });
    }
  }

  return orders;
}

// ---------------------------------------------------------------------------
// Vitals generation
// ---------------------------------------------------------------------------

interface VitalsOutput {
  bp: string;
  hr: number;
  rr: number;
  spo2: number;
  temp: string;
  weight: string;
}

function generateVitals(conditionCodes: Set<string>): VitalsOutput {
  const hasHTN = conditionCodes.has("I10");
  const hasCOPD = conditionCodes.has("J44.1");
  const hasHF = conditionCodes.has("I50.9");
  const hasAFib = conditionCodes.has("I48.91");
  const hasObesity = conditionCodes.has("E66.01");

  const systolic = hasHTN ? getRandomInt(130, 168) : getRandomInt(108, 135);
  const diastolic = hasHTN ? getRandomInt(80, 100) : getRandomInt(65, 85);
  let hr = getRandomInt(58, 98);
  if (hasAFib) hr = getRandomInt(68, 120);
  if (hasHF) hr = getRandomInt(70, 110);

  let spo2 = getRandomInt(95, 100);
  if (hasCOPD) spo2 = getRandomInt(88, 96);
  if (hasHF && random() > 0.7) spo2 = getRandomInt(90, 96);

  let weight = getRandomInt(130, 260);
  if (hasObesity) weight = getRandomInt(240, 380);

  return {
    bp: `${systolic}/${diastolic} mmHg`,
    hr,
    rr: getRandomInt(14, 22),
    spo2,
    temp: `${getRandom(97.8, 99.2).toFixed(1)}F`,
    weight: `${weight} lbs`,
  };
}

// ---------------------------------------------------------------------------
// Encounter (visit) generation
// ---------------------------------------------------------------------------

interface EncounterOutput {
  date: string;
  type: string;
  provider: string;
  chiefComplaint: string;
  assessment: string;
  plan: string;
  vitals: VitalsOutput;
  orders: OrderDef[];
}

function generateEncounter(
  age: number,
  gender: string,
  conditionCodes: Set<string>,
): Omit<EncounterOutput, "date"> & { date: string | null } {
  const hasHTN = conditionCodes.has("I10");
  const hasDM = conditionCodes.has("E11.9");
  const hasHF = conditionCodes.has("I50.9");
  const hasHL = conditionCodes.has("E78.5");
  const hasCOPD = conditionCodes.has("J44.1");
  const hasAFib = conditionCodes.has("I48.91");
  const hasCKD = conditionCodes.has("N18.3");

  const visitType = pickWeighted(visitTypeWeights).type;
  const complaint = getRandomItem(chiefComplaints);
  const vitals = generateVitals(conditionCodes);
  const provider = getRandomItem(providers);
  const orders = generateOrders(conditionCodes);

  let assessment: string;
  let plan: string;

  if (hasDM && hasHTN && hasCKD) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with T2DM, essential hypertension, and CKD stage 3 presenting for ${complaint.toLowerCase()}. BP ${vitals.bp}, above target for CKD. Glycemic control under review. Renal function trending.`;
    plan = "- Review HbA1c and adjust diabetes regimen; avoid nephrotoxic agents\n- Uptitrate ACE-I/ARB for BP and renal protection; recheck Cr/K in 2 weeks\n- Continue SGLT2 inhibitor for cardiorenal benefit\n- Dietary counseling: low-sodium, controlled protein, diabetic diet\n- Nephrology follow-up in 3 months; recheck eGFR and UACR";
  } else if (hasHF && hasAFib) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with HFrEF and atrial fibrillation presenting for ${complaint.toLowerCase()}. HR ${vitals.hr} bpm — rate control assessed. Volume status evaluated.`;
    plan = "- Continue GDMT for heart failure (beta-blocker, ARNI, MRA, SGLT2i)\n- Assess rate control; target HR <110 at rest\n- Continue anticoagulation (DOAC); verify compliance\n- Daily weights, 2L fluid restriction, <2g sodium\n- Cardiology/EP follow-up in 4-6 weeks";
  } else if (hasCOPD && hasHF) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with overlapping COPD and heart failure presenting for ${complaint.toLowerCase()}. SpO2 ${vitals.spo2}%. Dyspnea assessment — differentiating cardiac vs pulmonary etiology.`;
    plan = "- Optimize inhaler regimen; avoid beta-agonist overuse given cardiac history\n- Diuretic dose adjusted based on volume assessment\n- Chest X-ray to evaluate for pulmonary congestion vs COPD exacerbation\n- Pulmonary rehab referral\n- Follow-up in 4 weeks with repeat BNP and spirometry if indicated";
  } else if (hasDM && hasHTN) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with Type 2 DM and essential hypertension presenting for ${complaint.toLowerCase()}. BP ${vitals.bp} — above goal. HbA1c trending up.`;
    plan = "- Uptitrate metformin to 1000mg BID\n- Continue lisinopril; check renal function in 4 weeks\n- Dietary counseling referral placed\n- Return in 3 months with repeat HbA1c and metabolic panel";
  } else if (hasHF) {
    assessment = `${age}-year-old with heart failure presenting for ${complaint.toLowerCase()}. Currently euvolemic. BNP trend monitored.`;
    plan = "- Continue current HF regimen (carvedilol, furosemide, ARNI)\n- Daily weight monitoring; call if gain >2 lbs in 24h\n- Salt restriction reviewed: <2g/day sodium\n- Cardiology follow-up in 6 weeks";
  } else if (hasCOPD) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with COPD presenting for ${complaint.toLowerCase()}. SpO2 ${vitals.spo2}% on room air. Reviewed inhaler technique and exacerbation frequency.`;
    plan = "- Continue maintenance inhalers (LAMA + ICS/LABA)\n- Albuterol PRN for rescue\n- Smoking cessation counseling reinforced\n- Annual flu vaccine and pneumococcal vaccine status updated\n- Pulmonology follow-up in 3 months; consider PFTs";
  } else if (hasDM) {
    assessment = `Type 2 DM patient, ${age}-year-old ${gender.toLowerCase()}, presenting for ${complaint.toLowerCase()}. Glycemic control suboptimal.`;
    plan = "- Optimize diabetes medications\n- Recheck HbA1c in 3 months\n- Ophthalmology referral for annual diabetic eye exam\n- Foot exam performed — sensation intact, no ulcers";
  } else if (hasHTN && hasHL) {
    assessment = `Hypertension and hyperlipidemia; BP ${vitals.bp} today — above target. Presenting for ${complaint.toLowerCase()}.`;
    plan = "- Increase lisinopril dose to 20mg daily\n- Continue atorvastatin; recheck lipid panel in 3 months\n- DASH diet reinforced\n- Recheck BP in 4 weeks";
  } else if (hasHTN) {
    assessment = `Essential hypertension, BP ${vitals.bp} — above goal <130/80. Presenting for ${complaint.toLowerCase()}.`;
    plan = "- Continue/uptitrate antihypertensive\n- Sodium restriction counseling\n- Home BP monitoring log reviewed\n- Return in 4 weeks";
  } else if (hasAFib) {
    assessment = `${age}-year-old ${gender.toLowerCase()} with atrial fibrillation presenting for ${complaint.toLowerCase()}. HR ${vitals.hr} bpm today. On anticoagulation therapy.`;
    plan = "- Continue DOAC for stroke prevention\n- Rate control adequate; continue current rate-control agent\n- ECG obtained today for rhythm assessment\n- Electrophysiology follow-up in 3 months";
  } else {
    assessment = `Preventive visit. ${complaint}. No acute concerns. Vitals within acceptable range.`;
    plan = "- Continue current medications\n- Age-appropriate cancer screenings discussed\n- Annual labs ordered\n- Return in 12 months or sooner if symptoms";
  }

  return {
    date: null as unknown as string,
    type: visitType,
    provider,
    chiefComplaint: complaint,
    assessment,
    plan,
    vitals,
    orders,
  };
}

// ---------------------------------------------------------------------------
// Patient output shape
// ---------------------------------------------------------------------------

interface PatientOutput {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: string;
  race: string;
  ethnicity: string;
  language: string;
  maritalStatus: string;
  addressZip: string;
  insuranceType: string;
  isComplex: boolean;
  lastVisit: string;
  conditions: Array<{ code: string; display: string; onset: string; status: string }>;
  labResults: Array<{
    name: string;
    value: number;
    unit: string;
    flag: string;
    referenceRange: string;
    date: string;
  }>;
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    route: string;
    status: string;
    started: string;
    ended?: string;
  }>;
  allergies: Array<{ allergen: string; reaction: string; severity: string }>;
  immunizations: Array<{ name: string; cvx: string; date: string }>;
  encounters: EncounterOutput[];
  imagingReports: Array<{ type: string; finding: string; impression: string; date: string }>;
  socialHistory: {
    housingStatus: string;
    employmentStatus: string;
    foodSecurity: string;
    educationLevel: string;
    tobaccoUse: string;
    alcoholUse: string;
    recordedDate: string;
  };
  clinicalNotes: Array<{ noteType: string; content: string; author: string; date: string }>;
}

// ---------------------------------------------------------------------------
// Main patient generator
// ---------------------------------------------------------------------------

function generatePatient(id: number, forceComplex: boolean): PatientOutput {
  const isMale = random() > 0.5;
  const firstName = isMale ? getRandomItem(firstNamesMale) : getRandomItem(firstNamesFemale);
  const lastName = getRandomItem(lastNames);
  const gender = isMale ? "Male" : "Female";

  // Complex patients tend to be older
  const age = forceComplex ? getRandomInt(50, 85) : getRandomInt(18, 85);
  const birthYear = REFERENCE_YEAR - age;
  const dob = `${birthYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`;

  // Demographics
  const raceEntry = pickWeighted([...raceDistribution]);
  const race = raceEntry.value;
  const ethnicity = getRandomItem(ethnicityByRace[race]);
  const language = pickWeighted(languageByRace[race]).value;
  const maritalStatus = pickWeighted([...maritalStatusOptions]).value;
  const addressZip = getRandomItem(bronxZips);

  // Insurance — adjust for age (65+ → higher Medicare probability)
  let insuranceType: string;
  if (age >= 65) {
    const roll = random();
    insuranceType = roll < 0.70 ? "Medicare" : roll < 0.85 ? "Medicaid" : roll < 0.95 ? "Private" : "Uninsured";
  } else {
    insuranceType = pickWeighted([...insuranceDistribution]).value;
  }

  // ── Conditions ──────────────────────────────────────────────────────────

  const conditions: Array<{ code: string; display: string; onset: string; status: string }> = [];
  const conditionCodes = new Set<string>();

  if (forceComplex) {
    // Pick a cluster, then 4-6 conditions from it (plus possibly extra)
    const cluster = getRandomItem(complexClusters);
    const numFromCluster = getRandomInt(4, Math.min(6, cluster.length));
    // Shuffle cluster deterministically
    const shuffled = [...cluster];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < numFromCluster && i < shuffled.length; i++) {
      const c = shuffled[i];
      if (!conditionCodes.has(c.code)) {
        conditionCodes.add(c.code);
        const onsetYear = birthYear + getRandomInt(Math.max(0, age - 20), Math.max(1, age - 2));
        conditions.push({
          code: c.code,
          display: c.display,
          onset: `${onsetYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`,
          status: "active",
        });
      }
    }
    // Possibly add 0-2 more random conditions
    const extra = getRandomInt(0, 2);
    for (let i = 0; i < extra; i++) {
      let cond: ConditionDef;
      let attempts = 0;
      do {
        cond = getRandomItem(conditionsList);
        attempts++;
      } while (conditionCodes.has(cond.code) && attempts < 30);
      if (!conditionCodes.has(cond.code)) {
        conditionCodes.add(cond.code);
        const onsetYear = birthYear + getRandomInt(Math.max(0, age - 15), Math.max(1, age - 1));
        conditions.push({
          code: cond.code,
          display: cond.display,
          onset: `${onsetYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`,
          status: "active",
        });
      }
    }
  } else {
    const numConditions = getRandomInt(0, 4);
    for (let i = 0; i < numConditions; i++) {
      let cond: ConditionDef;
      let attempts = 0;
      do {
        cond = getRandomItem(conditionsList);
        attempts++;
      } while (conditionCodes.has(cond.code) && attempts < 30);
      if (!conditionCodes.has(cond.code)) {
        conditionCodes.add(cond.code);
        const onsetYear = birthYear + getRandomInt(0, Math.max(1, age - 5));
        conditions.push({
          code: cond.code,
          display: cond.display,
          onset: `${onsetYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`,
          status: random() > 0.05 ? "active" : "resolved",
        });
      }
    }
  }

  // ── Lab Results ─────────────────────────────────────────────────────────

  const numLabs = forceComplex ? getRandomInt(6, 12) : getRandomInt(2, 7);
  const labResults: PatientOutput["labResults"] = [];
  const usedLabNames = new Set<string>();

  for (let i = 0; i < numLabs; i++) {
    let test: LabTestDef;
    let attempts = 0;
    do {
      test = getRandomItem(labTests);
      attempts++;
    } while (usedLabNames.has(test.name) && attempts < 30);
    if (usedLabNames.has(test.name)) continue;
    usedLabNames.add(test.name);

    let value = getRandom(test.min, test.max);

    // Condition-specific lab value adjustments
    if (conditionCodes.has("E11.9") && test.name === "Hemoglobin A1c") value = getRandom(6.5, 10.5);
    if (conditionCodes.has("E11.9") && test.name === "Fasting Glucose") value = getRandom(126, 280);
    if (conditionCodes.has("E78.5") && test.name === "Total Cholesterol") value = getRandom(200, 320);
    if (conditionCodes.has("E78.5") && test.name === "LDL Cholesterol") value = getRandom(100, 220);
    if (conditionCodes.has("I50.9") && test.name === "BNP") value = getRandom(200, 900);
    if (conditionCodes.has("N18.3") && test.name === "eGFR") value = getRandom(15, 45);
    if (conditionCodes.has("N18.3") && test.name === "Creatinine") value = getRandom(1.5, 4.0);
    if (conditionCodes.has("N18.3") && test.name === "BUN") value = getRandom(25, 55);
    if (conditionCodes.has("N18.3") && test.name === "Potassium") value = getRandom(4.5, 5.8);
    if (conditionCodes.has("I48.91") && test.name === "INR") {
      // Patients on anticoagulation may have elevated INR
      value = conditionCodes.has("I82.40") ? getRandom(2.0, 3.5) : getRandom(1.0, 2.5);
    }
    if (conditionCodes.has("I82.40") && test.name === "INR") value = getRandom(2.0, 3.5);
    if (conditionCodes.has("I50.9") && test.name === "Sodium") value = getRandom(130, 140);
    if (conditionCodes.has("I50.9") && test.name === "Troponin I") value = getRandom(0.01, 0.15);

    let flag = "Normal";
    if (test.normalMax !== undefined && value > test.normalMax) flag = "High";
    if (test.normalMin !== undefined && value < test.normalMin) flag = "Low";

    labResults.push({
      name: test.name,
      value: Number(value.toFixed(test.name === "Troponin I" ? 2 : 1)),
      unit: test.unit,
      flag,
      referenceRange: test.referenceRange,
      date: getRandomDate(new Date(2023, 0, 1), REFERENCE_DATE),
    });
  }
  labResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Immunizations ───────────────────────────────────────────────────────

  const numVaccines = getRandomInt(1, 5);
  const immunizations: PatientOutput["immunizations"] = [];
  const usedVacCodes = new Set<string>();
  for (let i = 0; i < numVaccines; i++) {
    let vac;
    let attempts = 0;
    do {
      vac = getRandomItem(vaccines);
      attempts++;
    } while (usedVacCodes.has(vac.cvx) && attempts < 20);
    if (!usedVacCodes.has(vac.cvx)) {
      usedVacCodes.add(vac.cvx);
      immunizations.push({
        name: vac.name,
        cvx: vac.cvx,
        date: getRandomDate(new Date(2019, 0, 1), REFERENCE_DATE),
      });
    }
  }
  immunizations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Medications ─────────────────────────────────────────────────────────

  const medications: PatientOutput["medications"] = [];
  const usedMedNames = new Set<string>();

  for (const code of Array.from(conditionCodes)) {
    const meds = medicationsByCondition[code] || [];
    const numMeds = Math.min(getRandomInt(1, Math.min(3, meds.length)), meds.length);
    let added = 0;
    for (const med of meds) {
      if (added >= numMeds) break;
      if (!usedMedNames.has(med.name)) {
        usedMedNames.add(med.name);
        const startYear = birthYear + getRandomInt(Math.max(0, age - 12), Math.max(1, age - 1));
        const isActive = random() > 0.1;
        const started = `${startYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`;
        const medEntry: PatientOutput["medications"][0] = {
          name: med.name,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route,
          status: isActive ? "Active" : "Discontinued",
          started,
        };
        if (!isActive) {
          // Set an ended date after started
          const endedYear = startYear + getRandomInt(1, Math.max(1, REFERENCE_YEAR - startYear));
          medEntry.ended = `${endedYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`;
        }
        medications.push(medEntry);
        added++;
      }
    }
  }

  // General meds
  const numGeneralMeds = getRandomInt(0, 3);
  for (let i = 0; i < numGeneralMeds; i++) {
    const med = getRandomItem(generalMeds);
    if (!usedMedNames.has(med.name)) {
      usedMedNames.add(med.name);
      const startYear = birthYear + getRandomInt(Math.max(0, age - 8), Math.max(1, age - 1));
      medications.push({
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        route: med.route,
        status: "Active",
        started: `${startYear}-${String(getRandomInt(1, 12)).padStart(2, "0")}-${String(getRandomInt(1, 28)).padStart(2, "0")}`,
      });
    }
  }

  // ── Allergies ───────────────────────────────────────────────────────────

  const numAllergies = getRandomInt(0, 4);
  const allergies: PatientOutput["allergies"] = [];
  const usedAllergens = new Set<string>();
  for (let i = 0; i < numAllergies; i++) {
    let allergy;
    let attempts = 0;
    do {
      allergy = getRandomItem(allergyData);
      attempts++;
    } while (usedAllergens.has(allergy.allergen) && attempts < 20);
    if (!usedAllergens.has(allergy.allergen)) {
      usedAllergens.add(allergy.allergen);
      allergies.push({
        allergen: allergy.allergen,
        reaction: allergy.reaction,
        severity: allergy.severity,
      });
    }
  }

  // ── Encounters ──────────────────────────────────────────────────────────

  const numEncounters = forceComplex ? getRandomInt(5, 12) : getRandomInt(3, 8);
  const encounters: EncounterOutput[] = [];
  for (let i = 0; i < numEncounters; i++) {
    const encounter = generateEncounter(age, gender, conditionCodes);
    const daysAgo = getRandomInt(i * 30, (i + 1) * 120 + 60);
    encounter.date = new Date(REFERENCE_DATE.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    encounters.push(encounter as EncounterOutput);
  }
  encounters.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Imaging Reports ─────────────────────────────────────────────────────

  const imagingReports: PatientOutput["imagingReports"] = [];

  // Determine which imaging types are clinically relevant
  const relevantImagingTypes: string[] = [];
  if (conditionCodes.has("I50.9")) relevantImagingTypes.push("Chest X-Ray", "Echocardiogram");
  if (conditionCodes.has("J44.1")) relevantImagingTypes.push("Chest X-Ray", "CT Chest");
  if (conditionCodes.has("I48.91")) relevantImagingTypes.push("ECG (12-lead)", "Echocardiogram");
  if (conditionCodes.has("I82.40")) relevantImagingTypes.push("Lower Extremity Doppler Ultrasound");
  if (conditionCodes.has("N18.3")) relevantImagingTypes.push("Renal Ultrasound");

  const numImaging = forceComplex
    ? getRandomInt(2, 5)
    : conditionCodes.size > 0
      ? getRandomInt(0, 3)
      : getRandomInt(0, 1);

  const usedImagingTypes = new Set<string>();
  for (let i = 0; i < numImaging; i++) {
    let template: ImagingTemplate;

    if (relevantImagingTypes.length > 0 && i < relevantImagingTypes.length && random() > 0.3) {
      // Prefer clinically relevant imaging
      const targetType = relevantImagingTypes[i % relevantImagingTypes.length];
      template = imagingTemplates.find((t) => t.type === targetType) || getRandomItem(imagingTemplates);
    } else {
      template = getRandomItem(imagingTemplates);
    }

    if (usedImagingTypes.has(template.type) && random() > 0.3) continue; // allow occasional repeats
    usedImagingTypes.add(template.type);

    const findingEntry = getRandomItem(template.findings);
    imagingReports.push({
      type: template.type,
      finding: findingEntry.finding,
      impression: findingEntry.impression,
      date: getRandomDate(new Date(2023, 6, 1), REFERENCE_DATE),
    });
  }
  imagingReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Social History ──────────────────────────────────────────────────────

  let tobacco = pickWeighted(tobaccoOptions).value;
  // COPD patients more likely to have smoking history
  if (conditionCodes.has("J44.1") && random() > 0.3) {
    tobacco = random() > 0.5 ? "Former smoker" : "Current everyday smoker";
  }

  let alcohol = pickWeighted(alcoholOptions).value;

  // Adjust employment by age
  let employment = pickWeighted(employmentOptions).value;
  if (age >= 65 && random() > 0.3) employment = "Retired";
  if (age < 25 && random() > 0.5) employment = "Student";

  const socialHistory: PatientOutput["socialHistory"] = {
    housingStatus: pickWeighted(housingOptions).value,
    employmentStatus: employment,
    foodSecurity: pickWeighted(foodSecurityOptions).value,
    educationLevel: pickWeighted(educationOptions).value,
    tobaccoUse: tobacco,
    alcoholUse: alcohol,
    recordedDate: getRandomDate(new Date(2024, 0, 1), REFERENCE_DATE),
  };

  // ── Clinical Notes ──────────────────────────────────────────────────────

  const numNotes = forceComplex ? getRandomInt(3, 6) : getRandomInt(1, 3);
  const clinicalNotes: PatientOutput["clinicalNotes"] = [];

  for (let i = 0; i < numNotes; i++) {
    const noteType = forceComplex
      ? noteTypes[i % noteTypes.length] // Ensure variety for complex patients
      : getRandomItem(noteTypes);
    const author = noteType === "nursing" ? getRandomItem(nurseAuthors) : getRandomItem(providers);
    const noteDate = getRandomDate(new Date(2024, 0, 1), REFERENCE_DATE);
    clinicalNotes.push({
      noteType,
      content: generateClinicalNoteContent(noteType, age, gender, conditionCodes, author),
      author,
      date: noteDate,
    });
  }
  clinicalNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Assemble ────────────────────────────────────────────────────────────

  const lastVisit =
    encounters.length > 0
      ? encounters[0].date
      : getRandomDate(new Date(2023, 6, 1), REFERENCE_DATE);

  return {
    id: `PT-${String(id).padStart(4, "0")}`,
    name: `${firstName} ${lastName}`,
    dob,
    age,
    gender,
    race,
    ethnicity,
    language,
    maritalStatus,
    addressZip,
    insuranceType,
    isComplex: forceComplex,
    lastVisit,
    conditions,
    labResults,
    medications,
    allergies,
    immunizations,
    encounters,
    imagingReports,
    socialHistory,
    clinicalNotes,
  };
}

// ---------------------------------------------------------------------------
// Generate all patients
// ---------------------------------------------------------------------------

console.log(
  `Generating ${NUM_PATIENTS} baseline patients (${NUM_COMPLEX} complex) plus ${teachingPatients.length} teaching patients...`
);
console.log(`  Seed: ${PATIENT_SEED}`);
console.log(`  Reference date: ${REFERENCE_DATE.toISOString().slice(0, 10)}`);

const patients: PatientOutput[] = [...(teachingPatients as unknown as PatientOutput[])];

// First NUM_COMPLEX patients are complex
for (let i = 1; i <= NUM_PATIENTS; i++) {
  const isComplex = i <= NUM_COMPLEX;
  patients.push(generatePatient(i, isComplex));
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outDir = path.join(__dirname, "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, "patients.json");
fs.writeFileSync(outFile, JSON.stringify(patients, null, 2));

// ---------------------------------------------------------------------------
// Summary statistics
// ---------------------------------------------------------------------------

const stats = {
  total: patients.length,
  complex: patients.filter((p) => p.isComplex).length,
  standard: patients.filter((p) => !p.isComplex).length,
  genderMale: patients.filter((p) => p.gender === "Male").length,
  genderFemale: patients.filter((p) => p.gender === "Female").length,
  avgAge: Math.round(patients.reduce((s, p) => s + p.age, 0) / patients.length),
  avgConditions: (patients.reduce((s, p) => s + p.conditions.length, 0) / patients.length).toFixed(1),
  avgEncounters: (patients.reduce((s, p) => s + p.encounters.length, 0) / patients.length).toFixed(1),
  avgLabs: (patients.reduce((s, p) => s + p.labResults.length, 0) / patients.length).toFixed(1),
  avgMedications: (patients.reduce((s, p) => s + p.medications.length, 0) / patients.length).toFixed(1),
  avgImagingReports: (patients.reduce((s, p) => s + p.imagingReports.length, 0) / patients.length).toFixed(1),
  avgClinicalNotes: (patients.reduce((s, p) => s + p.clinicalNotes.length, 0) / patients.length).toFixed(1),
  totalEncounters: patients.reduce((s, p) => s + p.encounters.length, 0),
  totalLabs: patients.reduce((s, p) => s + p.labResults.length, 0),
  totalMedications: patients.reduce((s, p) => s + p.medications.length, 0),
  totalImaging: patients.reduce((s, p) => s + p.imagingReports.length, 0),
  totalClinicalNotes: patients.reduce((s, p) => s + p.clinicalNotes.length, 0),
};

// Race distribution
const raceCounts: Record<string, number> = {};
for (const p of patients) {
  raceCounts[p.race] = (raceCounts[p.race] || 0) + 1;
}

// Insurance distribution
const insuranceCounts: Record<string, number> = {};
for (const p of patients) {
  insuranceCounts[p.insuranceType] = (insuranceCounts[p.insuranceType] || 0) + 1;
}

// Condition frequency
const conditionFreq: Record<string, number> = {};
for (const p of patients) {
  for (const c of p.conditions) {
    conditionFreq[c.display] = (conditionFreq[c.display] || 0) + 1;
  }
}
const topConditions = Object.entries(conditionFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log("\n--- Summary ---");
console.log(`Total patients:       ${stats.total}`);
console.log(`  Teaching:           ${teachingPatients.length}`);
console.log(`  Complex:            ${stats.complex}`);
console.log(`  Standard:           ${stats.standard}`);
console.log(`  Male / Female:      ${stats.genderMale} / ${stats.genderFemale}`);
console.log(`  Average age:        ${stats.avgAge}`);
console.log(`  Avg conditions:     ${stats.avgConditions}`);
console.log(`  Avg encounters:     ${stats.avgEncounters}`);
console.log(`  Avg labs:           ${stats.avgLabs}`);
console.log(`  Avg medications:    ${stats.avgMedications}`);
console.log(`  Avg imaging:        ${stats.avgImagingReports}`);
console.log(`  Avg clinical notes: ${stats.avgClinicalNotes}`);
console.log(`\n  Total encounters:     ${stats.totalEncounters}`);
console.log(`  Total lab results:    ${stats.totalLabs}`);
console.log(`  Total medications:    ${stats.totalMedications}`);
console.log(`  Total imaging:        ${stats.totalImaging}`);
console.log(`  Total clinical notes: ${stats.totalClinicalNotes}`);

console.log("\n--- Race Distribution ---");
for (const [race, count] of Object.entries(raceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${race}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
}

console.log("\n--- Insurance Distribution ---");
for (const [ins, count] of Object.entries(insuranceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ins}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
}

console.log("\n--- Top 10 Conditions ---");
for (const [name, count] of topConditions) {
  console.log(`  ${name}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
}

const fileSizeMB = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
console.log(`\nOutput: ${outFile} (${fileSizeMB} MB)`);
console.log("Done.");
