import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateGoldenPatients } from './golden_patients.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NUM_PATIENTS = 1000;
const PATIENT_SEED = Number.parseInt(process.env.PATIENT_SEED || '61172026', 10);
const REFERENCE_DATE = new Date(process.env.PATIENT_REFERENCE_DATE || '2026-01-15T00:00:00Z');
const REFERENCE_YEAR = REFERENCE_DATE.getUTCFullYear();

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = createRng(PATIENT_SEED);

const firstNamesMale = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kevin", "Brian", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Raymond", "Gregory", "Samuel", "Frank", "Alexander", "Patrick", "Benjamin", "Jack", "Dennis", "Jerry", "Tyler", "Aaron"];
const firstNamesFemale = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Carol", "Amanda", "Dorothy", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia", "Kathleen", "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma", "Nicole", "Helen", "Samantha", "Katherine", "Christine", "Debra", "Rachel", "Carolyn", "Janet", "Catherine", "Maria", "Heather"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"];
const providers = ["Dr. Sarah Chen", "Dr. Marcus Williams", "Dr. Priya Patel", "Dr. James O'Brien", "Dr. Fatima Al-Hassan", "Dr. Robert Kim", "Dr. Lisa Thompson", "Dr. David Nguyen", "Dr. Maria Rodriguez", "Dr. John Smith", "Dr. Emily Johnson", "Dr. Michael Brown"];

const conditionsList = [
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
  { code: "N18.3", display: "Chronic kidney disease, stage 3" }
];

const labTests = [
  { name: "Hemoglobin A1c", unit: "%", min: 4.0, max: 10.0, normalMax: 5.6 },
  { name: "Fasting Glucose", unit: "mg/dL", min: 70, max: 250, normalMax: 99 },
  { name: "Total Cholesterol", unit: "mg/dL", min: 100, max: 320, normalMax: 199 },
  { name: "LDL Cholesterol", unit: "mg/dL", min: 50, max: 220, normalMax: 99 },
  { name: "HDL Cholesterol", unit: "mg/dL", min: 20, max: 80, normalMin: 40 },
  { name: "Triglycerides", unit: "mg/dL", min: 50, max: 500, normalMax: 150 },
  { name: "TSH", unit: "mIU/L", min: 0.1, max: 10.0, normalMin: 0.4, normalMax: 4.0 },
  { name: "Vitamin D", unit: "ng/mL", min: 8, max: 100, normalMin: 30 },
  { name: "Hemoglobin", unit: "g/dL", min: 9.0, max: 18.0, normalMin: 12.0, normalMax: 16.0 },
  { name: "Creatinine", unit: "mg/dL", min: 0.5, max: 4.0, normalMin: 0.6, normalMax: 1.2 },
  { name: "BNP", unit: "pg/mL", min: 5, max: 900, normalMax: 100 },
  { name: "eGFR", unit: "mL/min/1.73m²", min: 15, max: 90, normalMin: 60 }
];

const vaccines = [
  { name: "Influenza, seasonal, injectable", cvx: "141" },
  { name: "COVID-19, mRNA (updated 2024)", cvx: "208" },
  { name: "Tdap", cvx: "115" },
  { name: "Zoster recombinant (Shingrix)", cvx: "187" },
  { name: "Pneumococcal conjugate PCV15", cvx: "215" },
  { name: "Hepatitis B, adult", cvx: "43" },
  { name: "RSV vaccine, adult", cvx: "300" }
];

const medicationsByCondition = {
  "E11.9": [
    { name: "Metformin", dose: "1000 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Glipizide", dose: "5 mg", frequency: "Daily", route: "PO" },
    { name: "Empagliflozin", dose: "10 mg", frequency: "Daily", route: "PO" },
    { name: "Semaglutide", dose: "1 mg", frequency: "Weekly", route: "SubQ" },
    { name: "Insulin glargine", dose: "20 units", frequency: "Nightly", route: "SubQ" }
  ],
  "I10": [
    { name: "Lisinopril", dose: "10 mg", frequency: "Daily", route: "PO" },
    { name: "Amlodipine", dose: "5 mg", frequency: "Daily", route: "PO" },
    { name: "Metoprolol succinate", dose: "50 mg", frequency: "Daily", route: "PO" },
    { name: "Hydrochlorothiazide", dose: "25 mg", frequency: "Daily", route: "PO" },
    { name: "Losartan", dose: "50 mg", frequency: "Daily", route: "PO" }
  ],
  "E78.5": [
    { name: "Atorvastatin", dose: "40 mg", frequency: "Nightly", route: "PO" },
    { name: "Rosuvastatin", dose: "20 mg", frequency: "Nightly", route: "PO" },
    { name: "Ezetimibe", dose: "10 mg", frequency: "Daily", route: "PO" }
  ],
  "J45.909": [
    { name: "Albuterol inhaler", dose: "90 mcg/actuation", frequency: "PRN", route: "Inhaled" },
    { name: "Fluticasone/Salmeterol", dose: "250/50 mcg", frequency: "Twice Daily", route: "Inhaled" },
    { name: "Montelukast", dose: "10 mg", frequency: "Nightly", route: "PO" }
  ],
  "F32.A": [
    { name: "Sertraline", dose: "100 mg", frequency: "Daily", route: "PO" },
    { name: "Escitalopram", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Bupropion XL", dose: "300 mg", frequency: "Daily", route: "PO" }
  ],
  "K21.9": [
    { name: "Omeprazole", dose: "20 mg", frequency: "Daily", route: "PO" },
    { name: "Pantoprazole", dose: "40 mg", frequency: "Daily", route: "PO" }
  ],
  "E03.9": [
    { name: "Levothyroxine", dose: "75 mcg", frequency: "Daily", route: "PO" }
  ],
  "F41.1": [
    { name: "Buspirone", dose: "10 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Escitalopram", dose: "10 mg", frequency: "Daily", route: "PO" }
  ],
  "I50.9": [
    { name: "Carvedilol", dose: "12.5 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Furosemide", dose: "40 mg", frequency: "Daily", route: "PO" },
    { name: "Sacubitril/Valsartan", dose: "97/103 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Spironolactone", dose: "25 mg", frequency: "Daily", route: "PO" }
  ],
  "N18.3": [
    { name: "Sodium bicarbonate", dose: "650 mg", frequency: "Twice Daily", route: "PO" },
    { name: "Sevelamer", dose: "800 mg", frequency: "Three Times Daily", route: "PO" }
  ],
  "M19.90": [
    { name: "Celecoxib", dose: "200 mg", frequency: "Daily", route: "PO" },
    { name: "Meloxicam", dose: "15 mg", frequency: "Daily", route: "PO" }
  ]
};

const generalMeds = [
  { name: "Aspirin", dose: "81 mg", frequency: "Daily", route: "PO" },
  { name: "Vitamin D3", dose: "2000 IU", frequency: "Daily", route: "PO" },
  { name: "Multivitamin", dose: "1 tablet", frequency: "Daily", route: "PO" },
  { name: "Omega-3 fatty acids", dose: "1 g", frequency: "Daily", route: "PO" },
  { name: "Calcium carbonate", dose: "500 mg", frequency: "Twice Daily", route: "PO" }
];

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
  { allergen: "Amoxicillin", reaction: "Rash", severity: "Moderate" }
];

const chiefComplaints = [
  "Follow-up for chronic disease management", "Routine annual physical exam", "Blood pressure check",
  "Worsening shortness of breath", "Fatigue and generalized weakness", "Lower extremity edema",
  "Medication refill request", "Lab result review", "New onset headaches", "Poorly controlled blood glucose",
  "Weight gain concern", "Joint pain and stiffness", "Cough and URI symptoms", "Abdominal pain",
  "Follow-up after ED visit", "Post-hospitalization visit", "Dizziness and lightheadedness",
  "Annual wellness visit", "Chest pain, exertional", "Medication side effect concern"
];

function getRandomItem(arr) { return arr[Math.floor(random() * arr.length)]; }
function getRandom(min, max) { return random() * (max - min) + min; }
function getRandomInt(min, max) { return Math.floor(getRandom(min, max + 1)); }
function getRandomDate(start, end) {
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()))
    .toISOString().split('T')[0];
}

function generateVitals(hasHTN, hasDM) {
  const systolic = hasHTN ? getRandomInt(130, 165) : getRandomInt(108, 135);
  const diastolic = hasHTN ? getRandomInt(80, 100) : getRandomInt(65, 85);
  return {
    bp: `${systolic}/${diastolic} mmHg`,
    hr: getRandomInt(58, 98),
    rr: getRandomInt(14, 20),
    spo2: getRandomInt(94, 100),
    temp: `${getRandom(97.8, 99.2).toFixed(1)}°F`,
    weight: `${getRandomInt(130, 260)} lbs`
  };
}

function generateVisit(patientAge, patientGender, conditions, usedConditionCodes) {
  const hasHTN = usedConditionCodes.has("I10");
  const hasDM = usedConditionCodes.has("E11.9");
  const hasHF = usedConditionCodes.has("I50.9");
  const hasHL = usedConditionCodes.has("E78.5");

  const typeWeights = [
    { type: "Office Visit", w: 0.55 },
    { type: "Telehealth", w: 0.20 },
    { type: "ED Visit", w: 0.15 },
    { type: "Hospital Admission", w: 0.10 }
  ];
  const draw = random();
  let cumulative = 0;
  let visitType = "Office Visit";
  for (const { type, w } of typeWeights) {
    cumulative += w;
    if (draw < cumulative) { visitType = type; break; }
  }

  const complaint = getRandomItem(chiefComplaints);
  const vitals = generateVitals(hasHTN, hasDM);
  const provider = getRandomItem(providers);

  let assessment, plan, notes;

  if (hasDM && hasHTN) {
    assessment = `${patientAge}-year-old ${patientGender.toLowerCase()} with Type 2 DM and essential hypertension presenting for ${complaint.toLowerCase()}. BP ${vitals.bp} — above goal. HbA1c trending up.`;
    plan = "- Uptitrate metformin to 1000mg BID\n- Continue lisinopril; check renal function in 4 weeks\n- Dietary counseling referral placed\n- Return in 3 months with repeat HbA1c and metabolic panel";
    notes = `Patient is a ${patientAge}-year-old ${patientGender.toLowerCase()} with known Type 2 DM and essential hypertension presenting for ${complaint.toLowerCase()}. Reports adherence to medications but difficulty following low-carb diet. Reviews labs — HbA1c elevated at last check. Physical exam: well-appearing, mild bilateral ankle edema noted. Heart rate ${vitals.hr} bpm, BP ${vitals.bp}. Plan discussed with patient who verbalized understanding. Will return for follow-up in 3 months.`;
  } else if (hasHF) {
    assessment = `${patientAge}-year-old with heart failure presenting for ${complaint.toLowerCase()}. Currently euvolemic. BNP trend monitored.`;
    plan = "- Continue current HF regimen (carvedilol, furosemide, ARNI)\n- Daily weight monitoring; call if gain >2 lbs in 24h\n- Salt restriction reviewed: <2g/day sodium\n- Cardiology follow-up in 6 weeks";
    notes = `${patientAge}-year-old ${patientGender.toLowerCase()} with known HFrEF presenting for ${complaint.toLowerCase()}. Denies orthopnea, PND. Reports mild exertional dyspnea climbing stairs. Exam: JVD absent, lungs clear bilaterally, trace pedal edema. Vitals stable with BP ${vitals.bp}. Weight diary reviewed — compliant. Current regimen continued. Patient instructed to call with weight gain >2 lbs overnight.`;
  } else if (hasDM) {
    assessment = `Type 2 DM patient, ${patientAge}-year-old ${patientGender.toLowerCase()}, presenting for ${complaint.toLowerCase()}. Glycemic control suboptimal.`;
    plan = "- Optimize diabetes medications\n- Recheck HbA1c in 3 months\n- Ophthalmology referral for annual diabetic eye exam\n- Foot exam performed — sensation intact, no ulcers";
    notes = `${patientAge}-year-old ${patientGender.toLowerCase()} with T2DM presenting for ${complaint.toLowerCase()}. Reports glucose values in 140–180 range on home monitoring. Denies hypoglycemic episodes. No new symptoms. Foot exam unremarkable, monofilament sensation intact. Discussed importance of HbA1c monitoring and medication adherence. Patient engaged and asked good questions about CGM options.`;
  } else if (hasHTN && hasHL) {
    assessment = `Hypertension and hyperlipidemia; BP ${vitals.bp} today — above target. Presenting for ${complaint.toLowerCase()}.`;
    plan = "- Increase lisinopril dose to 20mg daily\n- Continue atorvastatin; recheck lipid panel in 3 months\n- DASH diet reinforced\n- Recheck BP in 4 weeks";
    notes = `${patientAge}-year-old ${patientGender.toLowerCase()} with HTN and hyperlipidemia presenting for ${complaint.toLowerCase()}. BP ${vitals.bp} today — persistently elevated despite current regimen. LDL at last check above goal. Denies chest pain, headache. DASH diet handout reviewed. Antihypertensive uptitrated. Will recheck BP and lipids at follow-up.`;
  } else if (hasHTN) {
    assessment = `Essential hypertension, BP ${vitals.bp} — above goal <130/80. Presenting for ${complaint.toLowerCase()}.`;
    plan = "- Continue/uptitrate antihypertensive\n- Sodium restriction counseling\n- Home BP monitoring log reviewed\n- Return in 4 weeks";
    notes = `${patientAge}-year-old ${patientGender.toLowerCase()} with essential hypertension presenting for ${complaint.toLowerCase()}. BP ${vitals.bp} today — elevated. Patient reports medication adherence. Denies headache, visual changes, chest pain. Home BP log shows consistently elevated morning readings. Discussed dietary modifications. Will reassess at next visit.`;
  } else {
    assessment = `Preventive visit. ${complaint}. No acute concerns. Vitals within acceptable range.`;
    plan = "- Continue current medications\n- Age-appropriate cancer screenings discussed\n- Annual labs ordered\n- Return in 12 months or sooner if symptoms";
    notes = `${patientAge}-year-old ${patientGender.toLowerCase()} presenting for ${complaint.toLowerCase()}. No acute complaints. Reports feeling generally well. Physical exam unremarkable. BP ${vitals.bp}, HR ${vitals.hr}. Preventive care discussed including screening colonoscopy, lipid panel, and vaccination status. Patient engaged and in good health overall. All questions answered to satisfaction.`;
  }

  return { date: null, type: visitType, provider, chiefComplaint: complaint, assessment, plan, vitals, notes };
}

function generatePatient(id) {
  const isMale = random() > 0.5;
  const firstName = isMale ? getRandomItem(firstNamesMale) : getRandomItem(firstNamesFemale);
  const lastName = getRandomItem(lastNames);
  const gender = isMale ? "Male" : "Female";

  const age = getRandomInt(18, 85);
  const birthYear = REFERENCE_YEAR - age;
  const dob = `${birthYear}-${String(getRandomInt(1, 12)).padStart(2, '0')}-${String(getRandomInt(1, 28)).padStart(2, '0')}`;

  // Conditions
  const numConditions = getRandomInt(0, 4);
  const conditions = [];
  const usedConditionCodes = new Set();
  for (let i = 0; i < numConditions; i++) {
    let cond, attempts = 0;
    do { cond = getRandomItem(conditionsList); attempts++; } while (usedConditionCodes.has(cond.code) && attempts < 20);
    if (!usedConditionCodes.has(cond.code)) {
      usedConditionCodes.add(cond.code);
      const onsetYear = birthYear + getRandomInt(0, Math.max(1, age - 5));
      conditions.push({ code: cond.code, display: cond.display, onset: `${onsetYear}-${String(getRandomInt(1, 12)).padStart(2, '0')}-${String(getRandomInt(1, 28)).padStart(2, '0')}` });
    }
  }

  // Labs
  const numLabs = getRandomInt(2, 7);
  const labs = [];
  const usedLabNames = new Set();
  for (let i = 0; i < numLabs; i++) {
    let test, attempts = 0;
    do { test = getRandomItem(labTests); attempts++; } while (usedLabNames.has(test.name) && attempts < 20);
    if (!usedLabNames.has(test.name)) {
      usedLabNames.add(test.name);
      let value = getRandom(test.min, test.max);
      if (usedConditionCodes.has("E11.9") && test.name === "Hemoglobin A1c") value = getRandom(6.5, 10.5);
      if (usedConditionCodes.has("E11.9") && test.name === "Fasting Glucose") value = getRandom(126, 250);
      if (usedConditionCodes.has("E78.5") && test.name === "Total Cholesterol") value = getRandom(200, 320);
      if (usedConditionCodes.has("E78.5") && test.name === "LDL Cholesterol") value = getRandom(100, 220);
      if (usedConditionCodes.has("I50.9") && test.name === "BNP") value = getRandom(200, 900);
      if (usedConditionCodes.has("N18.3") && test.name === "eGFR") value = getRandom(20, 45);
      if (usedConditionCodes.has("N18.3") && test.name === "Creatinine") value = getRandom(1.5, 4.0);
      let flag = "Normal";
      if (test.normalMax && value > test.normalMax) flag = "High";
      if (test.normalMin && value < test.normalMin) flag = "Low";
      labs.push({ name: test.name, value: Number(value.toFixed(1)), unit: test.unit, flag, date: getRandomDate(new Date(2023, 0, 1), REFERENCE_DATE) });
    }
  }
  labs.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Immunizations
  const numVaccines = getRandomInt(1, 5);
  const immunizations = [];
  const usedVacCodes = new Set();
  for (let i = 0; i < numVaccines; i++) {
    let vac, attempts = 0;
    do { vac = getRandomItem(vaccines); attempts++; } while (usedVacCodes.has(vac.cvx) && attempts < 20);
    if (!usedVacCodes.has(vac.cvx)) {
      usedVacCodes.add(vac.cvx);
      immunizations.push({ name: vac.name, cvx: vac.cvx, date: getRandomDate(new Date(2019, 0, 1), REFERENCE_DATE) });
    }
  }
  immunizations.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Medications
  const medications = [];
  const usedMedNames = new Set();
  for (const code of usedConditionCodes) {
    const meds = medicationsByCondition[code] || [];
    const numMeds = Math.min(getRandomInt(1, Math.min(3, meds.length)), meds.length);
    let added = 0;
    for (const med of meds) {
      if (added >= numMeds) break;
      if (!usedMedNames.has(med.name)) {
        usedMedNames.add(med.name);
        const startYear = birthYear + getRandomInt(Math.max(0, age - 12), Math.max(1, age - 1));
        medications.push({ name: med.name, dose: med.dose, frequency: med.frequency, route: med.route, status: random() > 0.1 ? "Active" : "Discontinued", started: `${startYear}-${String(getRandomInt(1, 12)).padStart(2, '0')}-${String(getRandomInt(1, 28)).padStart(2, '0')}` });
        added++;
      }
    }
  }
  const numGeneralMeds = getRandomInt(0, 2);
  for (let i = 0; i < numGeneralMeds; i++) {
    const med = getRandomItem(generalMeds);
    if (!usedMedNames.has(med.name)) {
      usedMedNames.add(med.name);
      const startYear = birthYear + getRandomInt(Math.max(0, age - 8), Math.max(1, age - 1));
      medications.push({ name: med.name, dose: med.dose, frequency: med.frequency, route: med.route, status: "Active", started: `${startYear}-${String(getRandomInt(1, 12)).padStart(2, '0')}-${String(getRandomInt(1, 28)).padStart(2, '0')}` });
    }
  }

  // Allergies
  const numAllergies = getRandomInt(0, 3);
  const allergies = [];
  const usedAllergens = new Set();
  for (let i = 0; i < numAllergies; i++) {
    let allergy, attempts = 0;
    do { allergy = getRandomItem(allergyData); attempts++; } while (usedAllergens.has(allergy.allergen) && attempts < 20);
    if (!usedAllergens.has(allergy.allergen)) {
      usedAllergens.add(allergy.allergen);
      allergies.push({ allergen: allergy.allergen, reaction: allergy.reaction, severity: allergy.severity });
    }
  }

  // Visits (3–8)
  const numVisits = getRandomInt(3, 8);
  const visits = [];
  for (let i = 0; i < numVisits; i++) {
    const visit = generateVisit(age, gender, conditions, usedConditionCodes);
    const daysAgo = getRandomInt(i * 45, (i + 1) * 150 + 90);
    visit.date = new Date(REFERENCE_DATE.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    visits.push(visit);
  }
  visits.sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastVisit = visits.length > 0 ? visits[0].date : getRandomDate(new Date(2023, 6, 1), REFERENCE_DATE);

  return {
    id: `PT-${String(id).padStart(4, '0')}`,
    name: `${firstName} ${lastName}`,
    dob, age, gender, conditions, labs, immunizations, medications, allergies, visits, lastVisit
  };
}

function applyBronxCohortConstraints(patient, bronxIndex) {
  const includeFlu = bronxIndex < 34;     // exactly 34/50
  const includeHighA1c = bronxIndex >= 38; // exactly 12/50

  patient.immunizations = patient.immunizations.filter(
    (imm) => !imm.name.toLowerCase().includes('influenza')
  );
  if (includeFlu) {
    patient.immunizations.push({
      name: 'Influenza, seasonal, injectable',
      cvx: '141',
      date: '2024-10-01',
    });
  }
  patient.immunizations.sort((a, b) => new Date(b.date) - new Date(a.date));

  patient.labs = patient.labs.filter(
    (lab) => lab.name.toLowerCase() !== 'hemoglobin a1c'
  );

  if (includeHighA1c) {
    const value = Number((8.1 + random() * 2.4).toFixed(1));
    patient.labs.push({
      name: 'Hemoglobin A1c',
      value,
      unit: '%',
      flag: 'High',
      date: '2024-12-15',
    });

    if (!patient.conditions.some((c) => c.code === 'E11.9')) {
      patient.conditions.push({
        code: 'E11.9',
        display: 'Type 2 diabetes mellitus without complications',
        onset: '2020-01-01',
      });
    }
  } else {
    const value = Number((5.4 + random() * 2.3).toFixed(1));
    patient.labs.push({
      name: 'Hemoglobin A1c',
      value,
      unit: '%',
      flag: value > 5.6 ? 'High' : 'Normal',
      date: '2024-11-15',
    });
  }

  patient.labs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

const patients = generateGoldenPatients();
for (let i = 1; i <= NUM_PATIENTS; i++) {
  const patient = generatePatient(i);

  // Bronx cohort is PT-0001 through PT-0050 (index 0..49 after 3 golden cases).
  const bronxIndex = patients.length - 3;
  if (bronxIndex >= 0 && bronxIndex < 50) {
    applyBronxCohortConstraints(patient, bronxIndex);
  }

  patients.push(patient);
}

const outDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'patients.json');
fs.writeFileSync(outFile, JSON.stringify(patients, null, 2));
console.log(
  `✓ Generated ${NUM_PATIENTS} synthetic + 3 golden patients (seed=${PATIENT_SEED}, referenceDate=${REFERENCE_DATE.toISOString().slice(0, 10)}) → ${outFile}`
);
