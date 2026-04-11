import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit } from "@/lib/api-request";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { validateBatchRunnableConfigs } from "@/lib/config-health";
import { getBenchmarkPackMeta } from "@/lib/course";
import { runBenchmarkJob } from "@/lib/benchmark/run-job";
import { reconcileStaleBenchmarkRuns } from "@/lib/benchmark/run-lifecycle";

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

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<StartRunBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const { configId, runMode } = body.data;
  if (!configId) {
    return errorResponse("configId is required.", 400, "bad_request");
  }

  const packId: BenchmarkPackId = body.data.packId ?? PACK_BY_MODE[runMode];

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to start benchmark run.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to run benchmarks.",
      403,
      "no_team"
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
    if (configError) {
      return routeErrorResponse(configError, "Failed to load configuration.");
    }
    return errorResponse("Configuration not found.", 404, "not_found");
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

  const config = mapDbRowToConfig(configRow);
  const invalidConfigs = await validateBatchRunnableConfigs([config]);
  if (invalidConfigs.length > 0) {
    return NextResponse.json(
      {
        error:
          "The selected configuration is not ready for batch benchmarking. Fix the configuration and try again.",
        code: "invalid_configs",
        invalidConfigs,
      },
      { status: 400 }
    );
  }

  try {
    await reconcileStaleBenchmarkRuns(supabase);
  } catch (error) {
    return routeErrorResponse(
      error,
      "Failed to reconcile stale benchmark runs."
    );
  }

  const { data: canRun, error: cooldownError } = await supabase.rpc(
    "can_run_benchmark",
    {
      p_team_id: ctx.team.teamId,
    }
  );

  if (cooldownError) {
    return routeErrorResponse(
      cooldownError,
      "Failed to check benchmark cooldown."
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
      cases_completed: 0,
      cases_total: getBenchmarkPackMeta(packId)?.caseCount ?? 0,
      last_progress_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError || !run) {
    return routeErrorResponse(insertError, "Failed to create benchmark run.");
  }

  waitUntil(
    runBenchmarkJob({
      runId: run.id,
      teamId: ctx.team.teamId,
      userId: ctx.user.id,
      config,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      packId,
      runMode,
    })
  );

  return NextResponse.json(
    {
      id: run.id,
      status: run.status,
      runMode,
      packId,
      casesCompleted: run.cases_completed ?? 0,
      casesTotal: run.cases_total ?? getBenchmarkPackMeta(packId)?.caseCount ?? 0,
    },
    { status: 202 }
  );
}
