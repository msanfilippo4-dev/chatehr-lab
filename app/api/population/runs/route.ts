import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { isMissingSupabaseTableError } from "@/lib/supabase-compat";

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
    return routeErrorResponse(error, "Failed to load population runs.");
  }
  if (!ctx.team) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("population_runs")
    .select("*")
    .eq("team_id", ctx.team.teamId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingSupabaseTableError(error, "population_runs")) {
      return NextResponse.json([]);
    }
    return routeErrorResponse(error, "Failed to load population runs.");
  }

  return NextResponse.json(
    (data ?? []).map((row) => {
      const slots = Array.isArray(row.slots) ? row.slots : [];
      const failedSlotCount = slots.filter(
        (slot: Record<string, unknown> | null) =>
          slot &&
          typeof slot === "object" &&
          ((slot as { status?: string }).status === "failed" ||
            Boolean((slot as { error?: unknown }).error))
      ).length;
      const completedSlotCount = Math.max(0, slots.length - failedSlotCount);

      return {
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        cohortId: row.cohort_id,
        cohortName: row.cohort_name,
        taskId: row.task_id,
        taskTitle: row.task_title,
        prompt: row.prompt,
        slots,
        partialFailure: failedSlotCount > 0,
        completedSlotCount,
        failedSlotCount,
        persisted: true,
        createdAt: row.created_at,
      };
    })
  );
}
