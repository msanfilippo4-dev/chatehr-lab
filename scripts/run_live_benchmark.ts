import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { mapDbRowToConfig } from "../lib/config-mapper";
import { runBenchmarkJob } from "../lib/benchmark/run-job";
import { validateBatchRunnableConfigs } from "../lib/config-health";
import { reconcileStaleBenchmarkRuns } from "../lib/benchmark/run-lifecycle";
import { getBenchmarkPackMeta } from "../lib/course";

type RunMode = "practice" | "checkpoint" | "official";
type PackId = "practice" | "checkpoint" | "final";

const PACK_BY_MODE: Record<RunMode, PackId> = {
  practice: "practice",
  checkpoint: "checkpoint",
  official: "final",
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args.set(key, value);
    index += 1;
  }

  const teamId = args.get("team-id");
  const userId = args.get("user-id");
  const configId = args.get("config-id");
  const runMode = args.get("run-mode") as RunMode | undefined;
  const packId = args.get("pack-id") as PackId | undefined;

  if (!teamId || !userId || !configId || !runMode) {
    throw new Error(
      [
        "Usage:",
        'npx tsx scripts/run_live_benchmark.ts --team-id <uuid> --user-id <uuid> --config-id <uuid> --run-mode <practice|checkpoint|official> [--pack-id <practice|checkpoint|final>]',
      ].join("\n")
    );
  }

  if (!["practice", "checkpoint", "official"].includes(runMode)) {
    throw new Error(`Unsupported run mode "${runMode}".`);
  }

  if (packId && !["practice", "checkpoint", "final"].includes(packId)) {
    throw new Error(`Unsupported pack id "${packId}".`);
  }

  return {
    teamId,
    userId,
    configId,
    runMode,
    packId: packId ?? PACK_BY_MODE[runMode],
  };
}

function parseEnvFile(contents: string) {
  const env: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadLocalEnv() {
  for (const relativePath of [".env.local", ".env"]) {
    const absolutePath = path.join(process.cwd(), relativePath);

    try {
      const parsed = parseEnvFile(await readFile(absolutePath, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  await loadLocalEnv();

  const { teamId, userId, configId, runMode, packId } = parseArgs(
    process.argv.slice(2)
  );
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createAdminClient();

  const { data: configRow, error: configError } = await supabase
    .from("configurations")
    .select("*")
    .eq("id", configId)
    .single();

  if (configError || !configRow) {
    throw new Error(`Failed to load configuration: ${configError?.message ?? "not found"}`);
  }

  if (configRow.team_id !== teamId) {
    throw new Error("Configuration does not belong to the supplied team.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    throw new Error("Supplied user is not a member of the supplied team.");
  }

  const { data: courseSettings, error: courseSettingsError } = await supabase
    .from("course_settings")
    .select("official_benchmark_locked, checkpoint_benchmark_locked")
    .eq("id", "hinf6117")
    .single();

  if (courseSettingsError) {
    throw new Error(
      `Failed to load course settings: ${courseSettingsError.message}`
    );
  }

  if (runMode === "official" && courseSettings?.official_benchmark_locked) {
    throw new Error("The final official benchmark is currently locked.");
  }

  if (runMode === "checkpoint" && courseSettings?.checkpoint_benchmark_locked) {
    throw new Error("The checkpoint benchmark is currently locked.");
  }

  const config = mapDbRowToConfig(configRow);
  const invalidConfigs = await validateBatchRunnableConfigs([config]);
  if (invalidConfigs.length > 0) {
    throw new Error(
      "The selected configuration is not ready for batch benchmarking."
    );
  }

  await reconcileStaleBenchmarkRuns(supabase);

  const { data: canRun, error: cooldownError } = await supabase.rpc(
    "can_run_benchmark",
    { p_team_id: teamId }
  );

  if (cooldownError) {
    throw new Error(`Failed to check benchmark cooldown: ${cooldownError.message}`);
  }

  if (!canRun) {
    throw new Error(
      "A benchmark run is already in progress or was started too recently."
    );
  }

  const { data: run, error: insertError } = await supabase
    .from("benchmark_runs")
    .insert({
      team_id: teamId,
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
    throw new Error(`Failed to create benchmark run: ${insertError?.message ?? "unknown"}`);
  }

  try {
    await runBenchmarkJob({
      runId: run.id,
      teamId,
      userId,
      config,
      packId,
      supabaseUrl,
      supabaseKey,
      runMode,
    });

    const { data: completedRun, error: completedRunError } = await supabase
      .from("benchmark_runs")
      .select("*")
      .eq("id", run.id)
      .single();

    if (completedRunError || !completedRun) {
      throw new Error(
        `Benchmark finished but the final run row could not be loaded: ${completedRunError?.message ?? "unknown"}`
      );
    }

    if (completedRun.status !== "completed") {
      throw new Error(
        `Benchmark run ended with status "${completedRun.status}" (run id: ${run.id})`
      );
    }

    console.log(
      JSON.stringify(
        {
          id: run.id,
          status: "completed",
          runMode,
          packId,
          configId,
          modelName: config.modelName,
          accuracyScore: completedRun.accuracy_score,
          safetyScore: completedRun.safety_score,
          biasEquityScore: completedRun.bias_equity_score,
          tournamentScore: completedRun.tournament_score,
          latencyP95Ms: completedRun.latency_p95_ms,
          totalCostUsd: completedRun.total_cost_usd,
          totalTokens: completedRun.total_tokens,
          evaluationCostUsd: completedRun.evaluation_cost_usd,
          evaluationTokens: completedRun.evaluation_tokens,
        },
        null,
        2
      )
    );
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
