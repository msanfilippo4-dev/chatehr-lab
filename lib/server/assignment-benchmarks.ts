/**
 * Instructor-only benchmarks shown in the submission review. The detailed answer keys
 * (AI draft sentences, AI replies, tickets) are in ./answer-keys.ts and are scored
 * automatically for the instructor view.
 */
export const assignmentBenchmarks: Record<string, string[]> = {
  "FORDMS-A1": [
    "The duplicate pair should remain separate or be queued for verification; the app does not authorize a direct merge.",
    "A defensible response cites DOB and language matches while recognizing phone, address, name, and MRN differences.",
    "The selected coding evidence must include one FY2027 ICD-10-CM example and one CPT service example.",
    "Optional TKT-1047: Liu H. came from a phone quick-registration without a search; book into MRN 6105100 after two-identifier verification and leave any merge to HIM.",
  ],
  "FORDMS-A2": [
    "The SOAP note keeps right-sided laterality and does not claim a neurologic exam; corrections use an amendment, never an edit.",
    "Lisinopril for Marcus Reed triggers the potassium interaction warning; a strong student does not override it (potassium binder plus repeat BMP is reasonable).",
    "Result follow-up names an owner and due date; acknowledgment alone is not loop closure.",
    "eMAR: the roommate wristband is a hard stop, succinate ER is a look-alike hard stop, and 50 mg for a 25 mg order is a dose mismatch; holding with 'wrong strength dispensed; pharmacy notified' is the model answer. An override needs a specific, defensible reason.",
    "TKT-1041: pharmacy stocks 50 mg tablets for a 25 mg order (scanner is correct). TKT-1042: critical result routed to an out-of-office NP with no delegate; escalation rule excludes ambulatory. TKT-1043: AI scribe draft accepted without correction; no post-signature edit.",
  ],
  "FORDMS-A3": [
    "Reconciliation decisions may differ by resource; a complete answer explains why rather than applying one rule to all items.",
    "A validated query names its denominator, final-status requirement, threshold, and a patient-level spot check.",
    "TKT-1045: the fall-reassessment drop is a measurement artifact (report reads only retired row FS-1180); including FS-2203 restores about 90%.",
    "TKT-1044: all CO-16/M76 denials are Dr. Patel's lab lines without diagnosis pointers; root cause is order favorites without diagnosis association. CO denials cannot be billed to the patient.",
  ],
  "FORDMS-A4": [
    "Planted draft errors: D2 (left/fall), D6 (neuro exam not done), D7 (another patient's diabetes), D9 (invented plan, amoxicillin despite allergy), D10 (omits allergy and naproxen), D12 (English although an interpreter was used). D1, D3, D4, D5, D8, D11 are supported.",
    "AI replies: IB-008 (stop lisinopril), IB-009 (wrong pharmacy), and IB-010 (English reply, unordered dose change) must not be sent as drafted; IB-011 is safe to send.",
    "A strong recommendation is conditional or no-go until high-risk workflow, interface, training, or downtime evidence is resolved, with an outcome measure, a balancing measure, and a specific rollback trigger.",
  ],
};
