import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit } from "@/lib/api-request";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { executeBenchmarkRun } from "@/lib/benchmark/runner";
import { getSessionContext } from "@/lib/server-context";

interface StartRunBody {
  configId: string;
  runMode: "practice" | "checkpoint" | "official";
  packId?: "practice" | "checkpoint" | "final";
}

type BenchmarkPackId = "practice" | "checkpoint" | "final";

const PACK_BY_MODE: Record<StartRunBody["runMode"], BenchmarkPackId> = {
  practice: "practice",
  checkpoint: "checkpoint",
  official: "final",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<StartRunBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const { configId, runMode } = body.data;
  if (!configId) {
    return NextResponse.json(
      { error: "configId is required." },
      { status: 400 }
    );
  }

  const packId: BenchmarkPackId = body.data.packId ?? PACK_BY_MODE[runMode];

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) {
    return NextResponse.json(
      { error: "You must be on a team to run benchmarks." },
      { status: 403 }
    );
  }

  const { data: courseSettings } = await supabase
    .from("course_settings")
    .select("official_benchmark_locked, checkpoint_benchmark_locked")
    .eq("id", "hinf6117")
    .single();

  if (runMode === "official" && courseSettings?.official_benchmark_locked) {
    return NextResponse.json(
      { error: "The final official benchmark is currently locked by the instructor." },
      { status: 403 }
    );
  }

  if (runMode === "checkpoint" && courseSettings?.checkpoint_benchmark_locked) {
    return NextResponse.json(
      { error: "The checkpoint benchmark is currently locked by the instructor." },
      { status: 403 }
    );
  }

  const { data: configRow, error: configError } = await supabase
    .from("configurations")
    .select("*")
    .eq("id", configId)
    .single();

  if (configError || !configRow) {
    return NextResponse.json(
      { error: "Configuration not found." },
      { status: 404 }
    );
  }

  if (configRow.team_id !== ctx.team.teamId) {
    return NextResponse.json(
      { error: "This configuration does not belong to your team." },
      { status: 403 }
    );
  }

  if (runMode === "official" && !configRow.is_frozen) {
    return NextResponse.json(
      {
        error:
          "Configuration must be frozen before running the final official benchmark.",
      },
      { status: 400 }
    );
  }

  const { data: canRun, error: cooldownError } = await supabase.rpc(
    "can_run_benchmark",
    {
      p_team_id: ctx.team.teamId,
    }
  );

  if (cooldownError) {
    return NextResponse.json(
      { error: "Failed to check benchmark cooldown." },
      { status: 500 }
    );
  }

  if (!canRun) {
    return NextResponse.json(
      {
        error:
          "A benchmark run is already in progress or was recently started. Please wait a few minutes between runs.",
      },
      { status: 429 }
    );
  }

  const { data: run, error: insertError } = await supabase
    .from("benchmark_runs")
    .insert({
      team_id: ctx.team.teamId,
      config_id: configRow.id,
      config_hash: configRow.config_hash,
      run_mode: runMode,
      pack_id: packId,
      status: "pending",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError || !run) {
    return NextResponse.json(
      { error: "Failed to create benchmark run." },
      { status: 500 }
    );
  }

  const config = mapDbRowToConfig(configRow);
  try {
    const result = await executeBenchmarkRun(
      run.id,
      ctx.team.teamId,
      config,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      packId
    );

    await supabase.from("audit_events").insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      event_type: "benchmark.run_completed",
      details: {
        run_id: run.id,
        run_mode: runMode,
        pack_id: packId,
        tournament_score: result.tournamentScore,
      },
    });

    return NextResponse.json({
      id: run.id,
      status: "completed",
      runMode,
      packId,
      accuracyScore: result.accuracyScore,
      safetyScore: result.safetyScore,
      biasEquityScore: result.biasEquityScore,
      tournamentScore: result.tournamentScore,
      latencyP95Ms: result.latencyP95Ms,
      totalCostUsd: result.totalCostUsd,
      totalTokens: result.totalTokens,
    });
  } catch (error) {
    await supabase.from("audit_events").insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      event_type: "benchmark.run_failed",
      details: {
        run_id: run.id,
        run_mode: runMode,
        pack_id: packId,
        error: error instanceof Error ? error.message : "unknown",
      },
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Benchmark execution failed.",
      },
      { status: 500 }
    );
  }
}
