// Shared TypeScript interfaces for ChatEHR Lab

export interface Condition {
  code: string;
  display: string;
  onset: string;
}

export interface LabResult {
  name: string;
  value: number;
  unit: string;
  flag: string;
  date: string;
}

export interface Immunization {
  name: string;
  cvx: string;
  date: string;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  route: string;
  status: "Active" | "Discontinued";
  started: string;
}

export interface Allergy {
  allergen: string;
  reaction: string;
  severity: "Mild" | "Moderate" | "Severe/Anaphylaxis";
}

export interface Vitals {
  bp: string;
  hr: number;
  rr: number;
  spo2: number;
  temp: string;
  weight: string;
}

export interface Visit {
  date: string;
  type: "Office Visit" | "ED Visit" | "Telehealth" | "Hospital Admission";
  provider: string;
  chiefComplaint: string;
  assessment: string;
  plan: string;
  vitals: Vitals;
  notes: string;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: string;
  conditions: Condition[];
  labs: LabResult[];
  immunizations: Immunization[];
  medications: Medication[];
  allergies: Allergy[];
  visits: Visit[];
  lastVisit: string;
}

export interface RAGChunk {
  id: string;
  source: string;
  title: string;
  text: string;
  keywords: string[];
}

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  usage?: UsageMetadata;
  ragChunks?: RAGChunk[];
  isError?: boolean;
  hint?: string;
}

export interface LabConfig {
  modelName: string;
  systemInstruction: string;
  temperature: number;
  contextLevel: "LIMITED" | "STANDARD" | "FULL";
  ragEnabled: boolean;
}
