import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import type { ProjectMilestoneKey } from "@/lib/types";

interface MilestoneBody {
  milestoneKey: ProjectMilestoneKey;
  completed: boolean;
  notes?: string;
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
    return routeErrorResponse(error, "Failed to load milestones.");
  }
  if (!ctx.team) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("milestone_status")
    .select("*")
    .eq("team_id", ctx.team.teamId)
    .order("milestone_key");

  if (error) {
    return routeErrorResponse(error, "Failed to load milestones.");
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }
  const body = await readJsonBodyWithLimit<MilestoneBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to update milestone.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to update milestones.",
      403,
      "no_team"
    );
  }

  const record = {
    team_id: ctx.team.teamId,
    milestone_key: body.data.milestoneKey,
    completed: body.data.completed,
    completed_at: body.data.completed ? new Date().toISOString() : null,
    notes: trimString(body.data.notes, 1000) || null,
  };

  const { data, error } = await supabase
    .from("milestone_status")
    .upsert(record, { onConflict: "team_id,milestone_key" })
    .select("*")
    .single();

  if (error) {
    return routeErrorResponse(error, "Failed to update milestone.");
  }

  return NextResponse.json(data);
}
