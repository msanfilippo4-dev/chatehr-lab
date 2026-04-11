import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clampNumber, readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { requireInstructor } from "@/lib/server-context";
import { isMissingSupabaseTableError } from "@/lib/supabase-compat";

interface GradeBody {
  teamId: string;
  experimentalDesign: number;
  benchmarkEvidence: number;
  costObservability: number;
  safetyReasoning: number;
  biasEquity: number;
  finalRecommendation: number;
  overallComments: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<GradeBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await requireInstructor(supabase, session);
  } catch {
    return NextResponse.json(
      { error: "Instructor access required." },
      { status: 403 }
    );
  }

  const payload = {
    team_id: trimString(body.data.teamId, 80),
    graded_by: ctx.user.id,
    experimental_design: clampNumber(body.data.experimentalDesign, 0, 25, 0),
    benchmark_evidence: clampNumber(body.data.benchmarkEvidence, 0, 20, 0),
    cost_observability: clampNumber(body.data.costObservability, 0, 15, 0),
    safety_reasoning: clampNumber(body.data.safetyReasoning, 0, 15, 0),
    bias_equity: clampNumber(body.data.biasEquity, 0, 15, 0),
    final_recommendation: clampNumber(body.data.finalRecommendation, 0, 10, 0),
    overall_comments: trimString(body.data.overallComments, 5000),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("instructor_grades")
    .upsert(payload, { onConflict: "team_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingSupabaseTableError(error, "instructor_grades")) {
      return NextResponse.json(
        { error: "Instructor grading is unavailable until the database migration is applied." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save instructor grade." },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
