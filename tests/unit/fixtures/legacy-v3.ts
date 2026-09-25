/**
 * A faithful copy of the v3 (pre-v5) formula seed plus a mid-A1 learner's work, used to
 * prove that the v3 → v4 migration never loses learner data.
 */
const names = [
  ["Liu Huang", "1984-03-19", "Mandarin", "she/her"],
  ["Marcus Reed", "1968-11-02", "English", "he/him"],
  ["Elena Garcia", "1976-07-14", "Spanish", "she/her"],
  ["Amina Yusuf", "1992-01-25", "Somali", "she/her"],
  ["James O'Brien", "1959-05-08", "English", "he/him"],
  ["Priya Shah", "1988-10-30", "Gujarati", "she/her"],
  ["Devon Brooks", "2001-06-16", "English", "they/them"],
  ["Sofia Petrov", "1947-12-09", "Russian", "she/her"],
  ["Mateo Rivera", "2012-04-04", "Spanish", "he/him"],
  ["Grace Kim", "1970-09-21", "Korean", "she/her"],
  ["Noah Williams", "1981-02-12", "English", "he/him"],
  ["Liu H.", "1984-03-19", "Mandarin", "she/her"],
] as const;

const insurerIds = ["INS-MCD", "INS-MCR", "INS-CPPO"] as const;
const insuranceLabels = ["Medicaid", "Medicare", "Commercial PPO"] as const;

export function legacyPatients() {
  return names.map((n, i) => ({
    id: `PT-${String(i + 1).padStart(3, "0")}`,
    mrn: `6105${String(100 + i)}`,
    name: n[0],
    dob: n[1],
    sex: i % 3 === 1 ? "Male" : "Female",
    pronouns: n[3],
    language: n[2],
    address: i === 11 ? "120 Example Ave Apt 4B, New York, NY 10000" : `${120 + i * 7} Example Avenue, New York, NY 100${String(i % 10).padStart(2, "0")}`,
    phone: i === 11 ? "(917) 555-4812" : `(212) 555-${String(1100 + i)}`,
    insurance: insuranceLabels[i % 3],
    insurerId: insurerIds[i % 3],
    memberId: `${["MCD", "MCR", "CPPO"][i % 3]}-${String(48210 + i * 37)}`,
    problems: [{ code: i % 2 ? "I10" : "E11.9", display: "legacy", onset: "2022-02-14" }],
    medications: [{ name: i % 2 ? "Lisinopril 10 mg tablet" : "Metformin 500 mg tablet", sig: "legacy", status: "Active" }],
    allergies: [{ allergen: i % 3 === 0 ? "Penicillin" : "No known drug allergies", reaction: i % 3 === 0 ? "Hives" : "", severity: i % 3 === 0 ? "Severe" : "None" }],
    vitals: [{ date: "2026-09-14", bp: "132/78", hr: 68 + i, weight: "150 lb" }],
    results: [{ date: "2026-09-14", name: "Potassium", value: "5.7 mmol/L", flag: "High", status: "Final" }],
    notes: [] as { id: string; author: string; recordedAt: string; kind: "Draft" | "Signed" | "Amendment"; subjective: string; objective: string; assessment: string; plan: string }[],
    duplicateCandidate: i === 0 ? "PT-012" : i === 11 ? "PT-001" : undefined,
    proxyAccess: i === 5 ? [{ name: "Anjali Shah", relationship: "Daughter", scope: "Scheduling and messages" }] : i === 8 ? [{ name: "Carmen Rivera", relationship: "Parent", scope: "Full portal access (minor)" }] : undefined,
  }));
}

/** A v3 workspace mid-way through A1, with a signed note, a registered patient, and routed message. */
export function legacyWorkspace() {
  const patients = legacyPatients();
  patients[0].notes.push({ id: "NOTE-student-1", author: "Student Clinician", recordedAt: "2026-09-22T15:00:00.000Z", kind: "Signed", subjective: "s", objective: "o", assessment: "a", plan: "p" });
  const registered = { ...legacyPatients()[1], id: "PT-013-abc", mrn: "61051134", name: "Test Person", registeredAt: "2026-09-22T15:05:00.000Z", duplicateCandidate: undefined, proxyAccess: undefined };
  return {
    version: 3,
    meta: { owner: "student@fordham.edu", createdAt: "2026-09-21T22:00:00.000Z", configVersion: 19 },
    appointments: [
      { id: "APT-001", patientId: "PT-001", date: "2026-09-21", time: "09:00", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Established patient", visitTypeId: "VT-EST", status: "Scheduled" },
      { id: "APT-student", patientId: "PT-002", date: "2026-09-28", time: "11:00", duration: 30, provider: "Dr. Chen", visitType: "Follow-up", status: "Scheduled", history: [{ at: "x", change: "Created" }, { at: "y", change: "Rescheduled from 2026-09-28 10:00 Dr. Chen" }] },
    ],
    patients: [...patients, registered] as unknown[],
    orders: [],
    tasks: [{ id: "TASK-001", patientId: "PT-002", title: "Call patient about high potassium and repeat test", due: "2026-09-22", complete: true, owner: "Clinical team" }],
    messages: [{ id: "MSG-001", patientId: "PT-003", from: "Elena Garcia", subject: "Home blood pressure readings", body: "…", date: "2026-09-20", status: "Routed", routedTo: "Clinical team pool" }],
    audit: [
      { id: "AUD-a", timestamp: "2026-09-22T15:10:00.000Z", actor: "Front Desk learner", action: "Escalate identity review", patientId: "PT-001", detail: "Compare PT-001 with PT-012", context: "PT-001", provenance: "earned", actorRole: "Front Desk" },
      { id: "AUD-b", timestamp: "2026-09-22T15:00:00.000Z", actor: "Front Desk learner", action: "Open chart", patientId: "PT-001", detail: "Liu Huang (6105100)", context: "PT-001", provenance: "earned", actorRole: "Front Desk" },
    ],
    exchanges: [],
    identityReviews: [{ id: "MPI-001", patientIds: ["PT-001", "PT-012"], signals: [], status: "Resolved", decision: "Need more information", note: "verify", decidedAt: "2026-09-22T15:20:00.000Z" }],
    queryRuns: [],
    savedQueries: [],
    implementation: [],
    registrations: [{ id: "REG-1", patientId: "PT-013-abc", createdAt: "2026-09-22T15:05:00.000Z", duplicateCandidates: [], decision: "No match found" }],
    eligibilityChecks: [],
    referrals: [],
    waitlist: [],
    aiReviews: [],
  };
}
