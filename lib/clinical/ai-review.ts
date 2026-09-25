/**
 * Fixed AI-draft review exercise (FORDMS-A4). This file holds only what the learner sees:
 * the source encounter and the scripted draft. The answer key lives in
 * lib/server/answer-keys.ts and is never sent to the browser.
 */
import type { SentenceLabel } from "../types";

export const AI_DRAFT_ID = "AIDRAFT-LIU-0921";
export const AI_DRAFT_PATIENT_ID = "PT-001";

export interface SourceLine { id: string; label: string; text: string }
export interface DraftSentence { id: string; text: string }

export const AI_SOURCE_LINES: SourceLine[] = [
  { id: "S1", label: "Identity and language", text: "Liu Huang, DOB 03/19/1984 (42 y), MRN 6105100. Preferred language Mandarin; video interpreter #4471 used for the whole visit." },
  { id: "S2", label: "Reason for visit", text: "Follow-up of right shoulder pain that started after increased lifting while restocking shelves at work." },
  { id: "S3", label: "History", text: "Pain improves with rest. Denies any fall, fever, weakness, or numbness." },
  { id: "S4", label: "Vitals", text: "BP 124/78, HR 72, Temp 36.8 °C, SpO2 99% on room air." },
  { id: "S5", label: "Examination", text: "Tenderness over the right lateral shoulder; active range of motion limited by pain. Neurologic examination not performed." },
  { id: "S6", label: "Problem list", text: "Bursitis of right shoulder (M75.51); mild intermittent asthma (J45.20). No diabetes on the problem list." },
  { id: "S7", label: "Allergies", text: "Penicillin: hives (allergy, severe)." },
  { id: "S8", label: "Medications", text: "Albuterol HFA as needed. Naproxen 500 mg twice daily for 5 days started at Hudson Urgent Care on 9/18 (pending reconciliation)." },
  { id: "S9", label: "Plan (Dr. Chen)", text: "Rest and activity modification, ice, physical therapy referral, follow-up in 4 weeks." },
  { id: "S10", label: "Orders", text: "No imaging and no new prescriptions ordered today." },
];

export const AI_DRAFT_SENTENCES: DraftSentence[] = [
  { id: "D1", text: "Liu Huang is a 42-year-old woman seen today for follow-up of shoulder pain." },
  { id: "D2", text: "She reports worsening left shoulder pain that began after a fall at home." },
  { id: "D3", text: "Pain improves with rest, and she denies fever, weakness, or numbness." },
  { id: "D4", text: "Blood pressure was 124/78 and heart rate 72." },
  { id: "D5", text: "There is tenderness over the lateral shoulder with pain-limited range of motion." },
  { id: "D6", text: "Neurologic examination is normal." },
  { id: "D7", text: "Her type 2 diabetes remains well controlled on metformin." },
  { id: "D8", text: "Assessment: bursitis of the right shoulder (M75.51)." },
  { id: "D9", text: "Plan: start amoxicillin 500 mg three times daily, order an MRI of the shoulder, and prescribe oxycodone 5 mg for five days." },
  { id: "D10", text: "Medications and allergies were reviewed with no changes." },
  { id: "D11", text: "Physical therapy referral placed; follow up in four weeks." },
  { id: "D12", text: "The patient verbalized understanding of the plan in English." },
];

export const SENTENCE_LABELS: { label: SentenceLabel; help: string }[] = [
  { label: "Supported", help: "A source line says this." },
  { label: "Unsupported", help: "No source says this; it may be invented." },
  { label: "Contradicts source", help: "A source line says something different." },
  { label: "Wrong patient detail", help: "True of someone, but not this patient." },
  { label: "Omission", help: "Leaves out something the source says that matters for safety." },
];

export const AI_REVIEW_DISPOSITIONS = [
  "Reject and redraft from the source",
  "Edit and retain with corrections",
  "Accept without changes",
] as const;
