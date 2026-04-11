import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseNoRowsError, toApiRouteError } from "@/lib/api-error";
import type { Patient } from "./types";

export async function loadPatientRecord(
  supabase: SupabaseClient,
  patientId: string
): Promise<Patient | null> {
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (patientError) {
    if (isSupabaseNoRowsError(patientError)) return null;
    throw toApiRouteError(patientError, "Failed to load patient.");
  }

  if (!patient) return null;

  const [
    conditionsResult,
    labsResult,
    medsResult,
    allergiesResult,
    immunizationsResult,
    encountersResult,
    imagingResult,
    socialHistoryResult,
    clinicalNotesResult,
  ] = await Promise.all([
    supabase
      .from("conditions")
      .select("code, display, onset, status")
      .eq("patient_id", patientId)
      .order("onset", { ascending: false }),
    supabase
      .from("lab_results")
      .select("name, value, unit, flag, reference_range, date")
      .eq("patient_id", patientId)
      .order("date", { ascending: false }),
    supabase
      .from("medications")
      .select("name, dose, frequency, route, status, started, ended")
      .eq("patient_id", patientId)
      .order("started", { ascending: false }),
    supabase
      .from("allergies")
      .select("allergen, reaction, severity")
      .eq("patient_id", patientId),
    supabase
      .from("immunizations")
      .select("name, cvx, date")
      .eq("patient_id", patientId)
      .order("date", { ascending: false }),
    supabase
      .from("encounters")
      .select(
        "id, date, type, provider, chief_complaint, assessment, plan, vitals, orders"
      )
      .eq("patient_id", patientId)
      .order("date", { ascending: false }),
    supabase
      .from("imaging_reports")
      .select("type, finding, impression, date")
      .eq("patient_id", patientId)
      .order("date", { ascending: false }),
    supabase
      .from("social_history")
      .select(
        "housing_status, employment_status, food_security, education_level, tobacco_use, alcohol_use, recorded_date"
      )
      .eq("patient_id", patientId)
      .order("recorded_date", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("clinical_notes")
      .select("encounter_id, note_type, content, author, date")
      .eq("patient_id", patientId)
      .order("date", { ascending: false }),
  ]);

  for (const result of [
    conditionsResult,
    labsResult,
    medsResult,
    allergiesResult,
    immunizationsResult,
    encountersResult,
    imagingResult,
    socialHistoryResult,
    clinicalNotesResult,
  ]) {
    if (result.error && !isSupabaseNoRowsError(result.error)) {
      throw toApiRouteError(result.error, "Failed to load patient details.");
    }
  }

  const notesByEncounter = new Map<string, string[]>();
  for (const note of clinicalNotesResult.data ?? []) {
    if (note.encounter_id) {
      const existing = notesByEncounter.get(note.encounter_id) ?? [];
      existing.push(`[${note.note_type}] ${note.content}`);
      notesByEncounter.set(note.encounter_id, existing);
    }
  }

  return {
    id: patient.id,
    name: patient.name,
    dob: patient.dob,
    age: patient.age,
    gender: patient.gender,
    race: patient.race,
    ethnicity: patient.ethnicity,
    language: patient.language,
    maritalStatus: patient.marital_status,
    addressZip: patient.address_zip,
    insuranceType: patient.insurance_type,
    isComplex: patient.is_complex,
    lastVisit: patient.last_visit,
    conditions: (conditionsResult.data ?? []).map((item) => ({
      code: item.code,
      display: item.display,
      onset: item.onset,
    })),
    labs: (labsResult.data ?? []).map((item) => ({
      name: item.name,
      value: parseFloat(String(item.value)),
      unit: item.unit,
      flag: item.flag,
      date: item.date,
    })),
    medications: (medsResult.data ?? []).map((item) => ({
      name: item.name,
      dose: item.dose,
      frequency: item.frequency,
      route: item.route,
      status: item.status,
      started: item.started,
    })),
    allergies: (allergiesResult.data ?? []).map((item) => ({
      allergen: item.allergen,
      reaction: item.reaction,
      severity: item.severity,
    })),
    immunizations: (immunizationsResult.data ?? []).map((item) => ({
      name: item.name,
      cvx: item.cvx,
      date: item.date,
    })),
    visits: (encountersResult.data ?? []).map((item) => ({
      date: item.date,
      type: item.type,
      provider: item.provider,
      chiefComplaint: item.chief_complaint,
      assessment: item.assessment,
      plan: item.plan,
      vitals: item.vitals ?? {
        bp: "Unknown",
        hr: 0,
        rr: 0,
        spo2: 0,
        temp: "Unknown",
        weight: "Unknown",
      },
      notes:
        notesByEncounter.get(item.id)?.join("\n\n") ??
        [item.assessment, item.plan].filter(Boolean).join("\n"),
    })),
    imagingReports: (imagingResult.data ?? []).map((item) => ({
      date: item.date,
      modality: item.type,
      bodyPart: item.type,
      findings: item.finding,
      impression: item.impression,
      orderingProvider: "ChartEHR Imported Result",
    })),
    socialHistory: socialHistoryResult.data
      ? {
          smokingStatus: socialHistoryResult.data.tobacco_use,
          alcoholUse: socialHistoryResult.data.alcohol_use,
          exerciseFrequency: "Not documented",
          occupation: socialHistoryResult.data.employment_status,
          livingSituation: socialHistoryResult.data.housing_status,
        }
      : undefined,
    clinicalNotes: (clinicalNotesResult.data ?? []).map((item) => ({
      date: item.date,
      author: item.author,
      noteType: item.note_type,
      content: item.content,
    })),
  };
}
