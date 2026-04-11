import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { requireInstructor } from "@/lib/server-context";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseTableError,
} from "@/lib/supabase-compat";

type TeamRow = {
  id: string;
  is_smoke_test?: boolean;
};

async function loadTeams(supabase: ReturnType<typeof createAdminClient>) {
  let result = await supabase.from("teams").select("id, is_smoke_test");

  if (result.error && isMissingSupabaseColumnError(result.error, "teams", "is_smoke_test")) {
    result = await supabase.from("teams").select("id");
    return {
      data: ((result.data ?? []) as TeamRow[]).map((team) => ({
        ...team,
        is_smoke_test: false,
      })),
      error: result.error,
    };
  }

  return { data: (result.data ?? []) as TeamRow[], error: result.error };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  try {
    await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load instructor overview.");
  }

  try {
    const teamsResult = await loadTeams(supabase);
    if (teamsResult.error) {
      throw teamsResult.error;
    }

    const visibleTeamIds = (teamsResult.data ?? [])
      .filter((team) => !team.is_smoke_test)
      .map((team) => team.id);

    if (visibleTeamIds.length === 0) {
      return NextResponse.json({
        teamCount: 0,
        notebookEntryCount: 0,
        flagCount: 0,
        populationRunCount: 0,
      });
    }

    const [notebookResult, flagsResult, populationResult] = await Promise.all([
      supabase
        .from("notebook_entries")
        .select("id", { count: "exact", head: true })
        .in("team_id", visibleTeamIds),
      supabase
        .from("instructor_flags")
        .select("id", { count: "exact", head: true })
        .in("team_id", visibleTeamIds),
      supabase
        .from("population_runs")
        .select("id", { count: "exact", head: true })
        .in("team_id", visibleTeamIds),
    ]);

    if (notebookResult.error) {
      throw notebookResult.error;
    }

    if (flagsResult.error) {
      throw flagsResult.error;
    }

    if (
      populationResult.error &&
      !isMissingSupabaseTableError(populationResult.error, "population_runs")
    ) {
      throw populationResult.error;
    }

    return NextResponse.json({
      teamCount: visibleTeamIds.length,
      notebookEntryCount: notebookResult.count ?? 0,
      flagCount: flagsResult.count ?? 0,
      populationRunCount: isMissingSupabaseTableError(
        populationResult.error,
        "population_runs"
      )
        ? 0
        : (populationResult.count ?? 0),
    });
  } catch (error) {
    return routeErrorResponse(error, "Failed to load instructor overview.");
  }
}
