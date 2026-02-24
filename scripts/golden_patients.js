export function generateGoldenPatients() {
  const lab001 = {
    id: "LAB-001",
    name: "Eleanor Vance",
    dob: "1955-03-12", age: 71, gender: "Female",
    conditions: [
      { code: "I50.9", display: "Heart failure, unspecified", onset: "2018-05-10" },
      { code: "I10", display: "Essential (primary) hypertension", onset: "2010-02-15" }
    ],
    labs: [
      { name: "BNP", value: 350.0, unit: "pg/mL", flag: "High", date: "2024-03-01" },
      { name: "Potassium", value: 4.2, unit: "mEq/L", flag: "Normal", date: "2024-03-01" },
      { name: "Creatinine", value: 1.4, unit: "mg/dL", flag: "High", date: "2024-03-01" }
    ],
    immunizations: [
      { name: "Influenza, seasonal, injectable", cvx: "141", date: "2023-10-15" }
    ],
    medications: [
      { name: "Carvedilol", dose: "12.5 mg", frequency: "Twice Daily", route: "PO", status: "Active", started: "2020-01-10" },
      { name: "Lisinopril", dose: "20 mg", frequency: "Daily", route: "PO", status: "Active", started: "2015-06-20" },
      { name: "Spironolactone", dose: "25 mg", frequency: "Daily", route: "PO", status: "Discontinued", started: "2022-01-05", ended: "2023-11-10" },
      { name: "Furosemide", dose: "40 mg", frequency: "Daily", route: "PO", status: "Active", started: "2019-03-15" }
    ],
    allergies: [],
    visits: [
      {
        date: "2024-03-15",
        type: "Office Visit", provider: "Dr. Sarah Chen",
        chiefComplaint: "Hospital follow-up for acute on chronic heart failure",
        vitals: { bp: "135/85 mmHg", hr: 78, rr: 16, spo2: 96, temp: "98.2°F", weight: "165 lbs" },
        assessment: "71-year-old female with HFrEF and HTN following recent admission for volume overload. Clinically euvolemic today.",
        plan: "- Continue current GDMT (Carvedilol, Lisinopril, Furosemide)\n- Spironolactone remains discontinued due to prior hyperkalemia episode\n- Repeat BMP in 2 weeks to monitor renal function",
        notes: "Patient presents for post-discharge follow-up. Reports breathing is much improved since leaving the hospital. Denies orthopnea or PND. Exertional dyspnea is back to baseline. She is taking her carvedilol and lisinopril as prescribed. I reminded her she should NOT resume her spironolactone. We reviewed her post-discharge labs drawn 3 days ago at the outside clinic which showed a creatinine of 1.5 and a potassium of 5.8 mEq/L. Given the elevated potassium, holding the spironolactone is appropriate. Will recheck BMP shortly."
      }
    ]
  };
  lab001.lastVisit = "2024-03-15";

  const lab002 = {
    id: "LAB-002",
    name: "Marcus Thorne",
    dob: "1968-07-22", age: 57, gender: "Male",
    conditions: [
      { code: "E11.9", display: "Type 2 diabetes mellitus without complications", onset: "2015-09-01" },
      { code: "E78.5", display: "Hyperlipidemia, unspecified", onset: "2016-11-12" }
    ],
    labs: [
      { name: "Fasting Glucose", value: 165.0, unit: "mg/dL", flag: "High", date: "2024-02-10" },
      { name: "Total Cholesterol", value: 210.0, unit: "mg/dL", flag: "High", date: "2024-02-10" },
      { name: "Creatinine", value: 0.9, unit: "mg/dL", flag: "Normal", date: "2024-02-10" }
    ],
    immunizations: [],
    medications: [
      { name: "Metformin", dose: "1000 mg", frequency: "Twice Daily", route: "PO", status: "Active", started: "2016-01-15" },
      { name: "Atorvastatin", dose: "40 mg", frequency: "Nightly", route: "PO", status: "Active", started: "2017-02-20" }
    ],
    allergies: [
      { allergen: "Sulfa drugs", reaction: "Hives", severity: "Moderate" }
    ],
    visits: [
      {
        date: "2024-02-15",
        type: "Office Visit", provider: "Dr. Marcus Williams",
        chiefComplaint: "Routine diabetes follow-up",
        vitals: { bp: "128/78 mmHg", hr: 72, rr: 14, spo2: 98, temp: "98.6°F", weight: "215 lbs" },
        assessment: "57-year-old male with T2DM and Hyperlipidemia. Both relatively uncontrolled.",
        plan: "- Continue Metformin 1000mg BID\n- Continue Atorvastatin 40mg\n- Refer to endocrinology for consideration of GLP-1 RA\n- Follow up in 3 months",
        notes: "Marcus is here for a routine check-up for his diabetes and cholesterol. He admits he has not been following his diet over the holidays. He feels fine and checks his sugar sporadically—usually runs 150-180 in the mornings. We reviewed his comprehensive metabolic panel but unfortunately, the lab forgot to run the A1c and lipid panel on last week's blood draw. However, we did receive a message from his cardiologist who saw him yesterday; the cardiologist drew point-of-care labs showing his HbA1c is currently 8.7% and his LDL Cholesterol is 142 mg/dL. We discussed that these are above goal. I am referring him to endo to discuss starting Semaglutide."
      }
    ]
  };
  lab002.lastVisit = "2024-02-15";

  const lab003 = {
    id: "LAB-003",
    name: "Chloe Davis",
    dob: "1998-11-04", age: 27, gender: "Female",
    conditions: [
      { code: "L70.0", display: "Acne vulgaris", onset: "2016-05-12" },
      { code: "J45.909", display: "Unspecified asthma, uncomplicated", onset: "2005-08-20" }
    ],
    labs: [
      { name: "Pregnancy test (hCG)", value: 450.0, unit: "mIU/mL", flag: "High", date: "2024-04-01" },
      { name: "Hemoglobin", value: 13.5, unit: "g/dL", flag: "Normal", date: "2024-04-01" }
    ],
    immunizations: [
      { name: "Influenza, seasonal, injectable", cvx: "141", date: "2023-11-05" }
    ],
    medications: [
      { name: "Isotretinoin", dose: "40 mg", frequency: "Daily", route: "PO", status: "Active", started: "2023-12-01" },
      { name: "Albuterol inhaler", dose: "90 mcg/actuation", frequency: "PRN", route: "Inhaled", status: "Active", started: "2010-01-01" },
      { name: "Ethinyl estradiol/Norethindrone", dose: "1 tablet", frequency: "Daily", route: "PO", status: "Active", started: "2023-11-15" }
    ],
    allergies: [
      { allergen: "Penicillin", reaction: "Rash", severity: "Mild" }
    ],
    visits: [
      {
        date: "2024-04-02",
        type: "Telehealth", provider: "Dr. Priya Patel",
        chiefComplaint: "Positive home pregnancy test",
        vitals: { bp: "115/70 mmHg", hr: 82, rr: 16, spo2: 99, temp: "98.4°F", weight: "140 lbs" },
        assessment: "27-year-old female, G1P0, presenting with a positive home pregnancy test, confirmed by serum hCG today. Currently on teratogenic acne medication.",
        plan: "- STOP ISOTRETINOIN IMMEDIATELY due to severe teratogenicity (Category X)\n- Schedule urgent OB/GYN appointment for early dating ultrasound and counseling\n- Continue prenatal vitamins\n- Asthma is stable, continue PRN albuterol",
        notes: "Patient scheduled a same-day telehealth visit after her home pregnancy test was positive yesterday. She has missed her last period. We ordered a stat serum qualitative and quantitative hCG this morning which came back over 400. She is very anxious because she has been taking Isotretinoin (Accutane) for her severe cystic acne. I counseled her extensively that this is a known severe teratogen and she must stop it immediately. We discussed referring her to high-risk OB given the exposure. She will drop off her remaining pills at the pharmacy for disposal."
      }
    ]
  };
  lab003.lastVisit = "2024-04-02";

  return [lab001, lab002, lab003];
}

export default generateGoldenPatients;
