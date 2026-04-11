import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";

interface ReflectionBody {
  bestConfigId?: string;
  title: string;
  summary: string;
  benchmarkEvidence: string;
  costObservability: string;
  biasEquityRisk: string;
  safetyControl: string;
  deploymentRecommendation: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }
  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load reflections.");
  }
  if (!ctx.team) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("reflection_submissions")
    .select("*")
    .eq("team_id", ctx.team.teamId)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    return routeErrorResponse(error, "Failed to load reflections.");
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<ReflectionBody>(req, 200_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to save reflection.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to save a reflection.",
      403,
      "no_team"
    );
  }

  const payload = {
    team_id: ctx.team.teamId,
    user_id: ctx.user.id,
    best_config_id: body.data.bestConfigId ?? null,
    title: trimString(body.data.title, 200) || "Final Reflection",
    summary: trimString(body.data.summary, 5000),
    benchmark_evidence: trimString(body.data.benchmarkEvidence, 5000),
    cost_observability: trimString(body.data.costObservability, 5000),
    bias_equity_risk: trimString(body.data.biasEquityRisk, 5000),
    safety_control: trimString(body.data.safetyControl, 5000),
    deployment_recommendation: trimString(
      body.data.deploymentRecommendation,
      5000
    ),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("reflection_submissions")
    .upsert(payload, { onConflict: "team_id" })
    .select("*")
    .single();

  if (error) {
    return routeErrorResponse(error, "Failed to save reflection.");
  }

  return NextResponse.json(data, { status: 201 });
}
