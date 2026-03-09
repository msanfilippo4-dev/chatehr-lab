// ---------------------------------------------------------------------------
// /api/benchmark/cases — List benchmark cases (GET)
// For public cases: return full details including prompt.
// For hidden/adversarial: return only id, category, title, difficulty.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const packId = url.searchParams.get("packId");

  const supabase = createAdminClient();

  // Fetch all benchmark cases
  let query = supabase
    .from("benchmark_cases")
    .select("id, category, title, description, patient_id, recommended_patient_id, prompt, ground_truth, scoring_method, max_score, difficulty, case_set, pack_id, phase, learning_objective, evidence_checklist, fairness_dimension, recommended_comparison")
    .order("category", { ascending: true });

  if (packId) {
    query = query.eq("pack_id", packId);
  }

  const { data: cases, error } = await query;

  if (error) {
    console.error("Failed to fetch benchmark cases:", error);
    return NextResponse.json({ error: "Failed to load benchmark cases" }, { status: 500 });
  }

  // Filter response based on case_set visibility
  const result = (cases ?? []).map((c) => {
    if (c.case_set === "public") {
      // Public cases: return full details
      return {
        id: c.id,
        category: c.category,
        title: c.title,
        description: c.description,
        patientId: c.patient_id,
        recommendedPatientId: c.recommended_patient_id,
        prompt: c.prompt,
        groundTruth: c.ground_truth,
        scoringMethod: c.scoring_method,
        maxScore: c.max_score,
        difficulty: c.difficulty,
        caseSet: c.case_set,
        packId: c.pack_id,
        phase: c.phase,
        learningObjective: c.learning_objective,
        evidenceChecklist: c.evidence_checklist,
        fairnessDimension: c.fairness_dimension,
        recommendedComparison: c.recommended_comparison,
      };
    } else {
      // Hidden/adversarial: return metadata only (NO prompt, NO ground_truth)
      return {
        id: c.id,
        category: c.category,
        title: c.title,
        difficulty: c.difficulty,
        caseSet: c.case_set,
        packId: c.pack_id,
        phase: c.phase,
        learningObjective: c.learning_objective,
        fairnessDimension: c.fairness_dimension,
      };
    }
  });

  return NextResponse.json(result);
}
