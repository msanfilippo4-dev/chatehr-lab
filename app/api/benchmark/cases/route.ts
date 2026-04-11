import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packId = new URL(req.url).searchParams.get("packId");
  const supabase = createAdminClient();

  let query = supabase
    .from("benchmark_cases")
    .select(
      "id, category, title, description, patient_id, recommended_patient_id, prompt, ground_truth, scoring_method, max_score, difficulty, case_set, pack_id, phase, learning_objective, evidence_checklist, fairness_dimension, recommended_comparison"
    )
    .order("category", { ascending: true });

  if (packId) {
    query = query.eq("pack_id", packId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch benchmark cases:", error);
    return NextResponse.json(
      { error: "Failed to load benchmark cases" },
      { status: 500 }
    );
  }

  const response = (data ?? []).map((row) =>
    row.case_set === "public"
      ? {
          id: row.id,
          category: row.category,
          title: row.title,
          description: row.description,
          patientId: row.patient_id,
          recommendedPatientId: row.recommended_patient_id,
          prompt: row.prompt,
          groundTruth: row.ground_truth,
          scoringMethod: row.scoring_method,
          maxScore: row.max_score,
          difficulty: row.difficulty,
          caseSet: row.case_set,
          packId: row.pack_id,
          phase: row.phase,
          learningObjective: row.learning_objective,
          evidenceChecklist: row.evidence_checklist,
          fairnessDimension: row.fairness_dimension,
          recommendedComparison: row.recommended_comparison,
        }
      : {
          id: row.id,
          category: row.category,
          title: row.title,
          difficulty: row.difficulty,
          caseSet: row.case_set,
          packId: row.pack_id,
          phase: row.phase,
          learningObjective: row.learning_objective,
          fairnessDimension: row.fairness_dimension,
        }
  );

  return NextResponse.json(response);
}
