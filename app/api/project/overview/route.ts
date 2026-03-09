import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_MILESTONES } from "@/lib/course";
import { getSessionContext } from "@/lib/server-context";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);

  if (!ctx.team) {
    return NextResponse.json({
      team: null,
      milestoneProgress: PROJECT_MILESTONES.map((milestone) => ({
        ...milestone,
        completed: false,
        completedAt: null,
        notes: null,
      })),
      counts: {
        configs: 0,
        experiments: 0,
        notebookEntries: 0,
        practiceRuns: 0,
        checkpointRuns: 0,
        officialRuns: 0,
        reflections: 0,
      },
      recentRuns: [],
    });
  }

  const teamId = ctx.team.teamId;

  const [
    configsResult,
    experimentsResult,
    notebookResult,
    reflectionsResult,
    benchmarkResult,
    practiceRunCountResult,
    checkpointRunCountResult,
    officialRunCountResult,
    milestonesResult,
  ] = await Promise.all([
    supabase
      .from("configurations")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    supabase
      .from("experiment_runs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    supabase
      .from("notebook_entries")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    supabase
      .from("reflection_submissions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    supabase
      .from("benchmark_runs")
      .select(
        "id, run_mode, pack_id, status, tournament_score, accuracy_score, safety_score, bias_equity_score, completed_at, created_at"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("benchmark_runs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("run_mode", "practice"),
    supabase
      .from("benchmark_runs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("run_mode", "checkpoint"),
    supabase
      .from("benchmark_runs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("run_mode", "official"),
    supabase
      .from("milestone_status")
      .select("milestone_key, completed, completed_at, notes")
      .eq("team_id", teamId),
  ]);

  const milestoneByKey = new Map(
    (milestonesResult.data ?? []).map((row) => [row.milestone_key, row])
  );

  const recentRuns = (benchmarkResult.data ?? []).map((run) => ({
    id: run.id,
    runMode: run.run_mode,
    packId: run.pack_id,
    status: run.status,
    tournamentScore: run.tournament_score,
    accuracyScore: run.accuracy_score,
    safetyScore: run.safety_score,
    biasEquityScore: run.bias_equity_score,
    completedAt: run.completed_at,
    createdAt: run.created_at,
  }));

  return NextResponse.json({
    team: {
      id: teamId,
      name: ctx.team.teamName,
      joinCode: ctx.team.joinCode,
      role: ctx.team.role,
      memberCount: ctx.team.memberCount,
    },
    milestoneProgress: PROJECT_MILESTONES.map((milestone) => {
      const row = milestoneByKey.get(milestone.key);
      return {
        ...milestone,
        completed: row?.completed ?? false,
        completedAt: row?.completed_at ?? null,
        notes: row?.notes ?? null,
      };
    }),
    counts: {
      configs: configsResult.count ?? 0,
      experiments: experimentsResult.count ?? 0,
      notebookEntries: notebookResult.count ?? 0,
      practiceRuns: practiceRunCountResult.count ?? 0,
      checkpointRuns: checkpointRunCountResult.count ?? 0,
      officialRuns: officialRunCountResult.count ?? 0,
      reflections: reflectionsResult.count ?? 0,
    },
    recentRuns,
  });
}
