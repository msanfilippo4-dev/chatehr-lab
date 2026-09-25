import type { CoverageFields, Department, Facility, Insurer, Location, Organization } from "../config/types";

export const insurers: Insurer[] = [
  { id: "INS-MCD", name: "New York State Medicaid (teaching plan)", payerType: "Medicaid", planTypes: ["Fee-for-service", "Managed care"], eligibilityNote: "Eligibility can change monthly; verify on the date of service." },
  { id: "INS-MCR", name: "Medicare (teaching plan)", payerType: "Medicare", planTypes: ["Part B", "Medicare Advantage"], eligibilityNote: "Medicare Advantage plans may require referrals or authorizations that traditional Medicare does not." },
  { id: "INS-CPPO", name: "Crescent Commercial PPO (fictional)", payerType: "Commercial", planTypes: ["PPO", "HDHP"], eligibilityNote: "Deductible status affects patient cost estimates; the eligibility response reports what has been met." },
  { id: "INS-MMC", name: "NY Medicaid Managed Care (teaching plan)", payerType: "Medicaid", planTypes: ["Managed care", "Child Health Plus"], eligibilityNote: "Managed-care enrollment is recertified yearly; a lapse or a new member ID is common after recertification." },
  { id: "INS-MA", name: "Medicare Advantage HMO (teaching plan)", payerType: "Medicare", planTypes: ["Medicare Advantage HMO"], eligibilityNote: "Requires prior authorization for advanced imaging and echocardiography, and PCP referrals for specialists." },
  { id: "INS-CHMO", name: "Crescent Commercial HMO (fictional)", payerType: "Commercial", planTypes: ["HMO"], eligibilityNote: "Specialist visits need a PCP referral number on the claim." },
  { id: "INS-SELF", name: "Self-pay", payerType: "Self-pay", planTypes: ["Self-pay"], eligibilityNote: "No payer verification; document the financial counseling conversation." },
];

export const coverageFields: CoverageFields = {
  eligibilityStatuses: ["Active", "Inactive", "Needs verification"],
  cobOrders: ["Primary", "Secondary", "Tertiary"],
  verificationSources: ["Real-time 270/271 response (simulated)", "Payer portal (simulated)", "Phone verification (simulated)", "Card on file only"],
};

export const organizations: Organization[] = [
  { id: "ORG-CH", name: "Fordham Health", type: "Integrated delivery network (fictional)" },
];

export const facilities: Facility[] = [
  { id: "FAC-LC", organizationId: "ORG-CH", name: "Fordham Health Lincoln Center Clinic", address: "Fictional address, New York, NY" },
  { id: "FAC-HOSP", organizationId: "ORG-CH", name: "Fordham Health Hospital", address: "Fictional address, New York, NY" },
];

export const departments: Department[] = [
  { id: "DEP-IM", facilityId: "FAC-LC", name: "Internal Medicine" },
  { id: "DEP-HIM", facilityId: "FAC-LC", name: "Health Information Management" },
  { id: "DEP-LAB", facilityId: "FAC-LC", name: "Laboratory" },
  { id: "DEP-FM", facilityId: "FAC-LC", name: "Family Medicine" },
  { id: "DEP-ENDO", facilityId: "FAC-LC", name: "Endocrinology" },
  { id: "DEP-4W", facilityId: "FAC-HOSP", name: "4 West Medical-Surgical" },
  { id: "DEP-RCM", facilityId: "FAC-LC", name: "Revenue Cycle (Patient Financial Services)" },
];

export const locations: Location[] = [
  { id: "LOC-EX1", departmentId: "DEP-IM", name: "Exam room 1", kind: "Exam room" },
  { id: "LOC-EX2", departmentId: "DEP-IM", name: "Exam room 2", kind: "Exam room" },
  { id: "LOC-DRAW", departmentId: "DEP-LAB", name: "Draw station", kind: "Procedure" },
  { id: "LOC-412", departmentId: "DEP-4W", name: "Room 412-B", kind: "Inpatient bed" },
  { id: "LOC-415", departmentId: "DEP-4W", name: "Room 415-A", kind: "Inpatient bed" },
];
