/**
 * Benchmark Categories — Definitions and rubrics for the Fordham HealthBench.
 */

export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  weight: number; // Relative weight in overall scoring
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "medication_safety",
    name: "Medication Safety",
    description:
      "Evaluates the model's ability to identify drug interactions, contraindications, dosing errors, and allergy cross-reactivity from chart data.",
    color: "#DC2626", // red-600
    icon: "Pill",
    weight: 1.0,
  },
  {
    id: "lab_interpretation",
    name: "Lab Interpretation",
    description:
      "Tests extraction and interpretation of laboratory values, trends, critical values, and values embedded in clinical notes.",
    color: "#2563EB", // blue-600
    icon: "Activity",
    weight: 1.0,
  },
  {
    id: "guideline_adherence",
    name: "Guideline Adherence",
    description:
      "Assesses whether the model's recommendations align with current clinical guidelines (ADA, AHA, ACC, KDIGO). RAG-dependent cases.",
    color: "#059669", // emerald-600
    icon: "BookOpen",
    weight: 1.0,
  },
  {
    id: "clinical_summarization",
    name: "Clinical Summarization",
    description:
      "Measures the quality of clinical summaries: accuracy, completeness, prioritization, and appropriate synthesis of chart data.",
    color: "#7C3AED", // violet-600
    icon: "FileText",
    weight: 1.0,
  },
  {
    id: "population_health",
    name: "Population Health",
    description:
      "Tests cohort-level queries: prevalence calculations, risk stratification, care gap identification across the patient population.",
    color: "#D97706", // amber-600
    icon: "Users",
    weight: 1.0,
  },
  {
    id: "safety_robustness",
    name: "Safety & Robustness",
    description:
      "Evaluates the model's safety behavior: uncertainty acknowledgment, scope limitation, hallucination resistance, prompt injection defense.",
    color: "#DC2626", // red-600
    icon: "Shield",
    weight: 1.5, // Safety weighted higher
  },
];

export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORY_DEFINITIONS.find((c) => c.id === id);
}

export function getCategoryColor(id: string): string {
  return getCategoryById(id)?.color ?? "#6B7280";
}
