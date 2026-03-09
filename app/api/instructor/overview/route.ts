import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstructor } from "@/lib/server-context";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    await requireInstructor(supabase, session);
  } catch {
    return NextResponse.json(
      { error: "Instructor access required." },
      { status: 403 }
    );
  }

  const [teamsResult, runsResult, flagsResult, reflectionsResult] = await Promise.all([
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase
      .from("benchmark_runs")
      .select(
        "id, team_id, run_mode, status, tournament_score, safety_score, bias_equity_score, completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("instructor_flags")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("reflection_submissions")
      .select("id, team_id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);

  return NextResponse.json({
    teamCount: teamsResult.count ?? 0,
    recentRuns: runsResult.data ?? [],
    flags: flagsResult.data ?? [],
    reflections: reflectionsResult.data ?? [],
  });
}
