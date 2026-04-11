import { createClient } from "@supabase/supabase-js";
import { executeBenchmarkRun, updateBenchmarkRunFailure } from "./runner";
import type { ConfigSnapshot } from "../types";

type BenchmarkPackId = "practice" | "checkpoint" | "final";

interface RunBenchmarkJobArgs {
  runId: string;
  teamId: string;
  userId: string;
  config: ConfigSnapshot;
  packId: BenchmarkPackId;
  supabaseUrl: string;
  supabaseKey: string;
  runMode: "practice" | "checkpoint" | "official";
}

export async function runBenchmarkJob(args: RunBenchmarkJobArgs) {
  const supabase = createClient(args.supabaseUrl, args.supabaseKey);
  try {
    const progressTimestamp = new Date().toISOString();
    const { data: claimResult, error: claimError } = await supabase
      .from("benchmark_runs")
      .update({
        status: "running",
        started_at: progressTimestamp,
        last_progress_at: progressTimestamp,
      })
      .eq("id", args.runId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError) {
      throw new Error(`Failed to claim benchmark run: ${claimError.message}`);
    }

    if (!claimResult) {
      return;
    }

    const result = await executeBenchmarkRun(
      args.runId,
      args.teamId,
      args.userId,
      args.config,
      args.supabaseUrl,
      args.supabaseKey,
      args.packId
    );

    await supabase.from("audit_events").insert({
      team_id: args.teamId,
      user_id: args.userId,
      event_type: "benchmark.run_completed",
      details: {
        run_id: args.runId,
        run_mode: args.runMode,
        pack_id: args.packId,
        tournament_score: result.tournamentScore,
      },
    });
  } catch (error) {
    const { data: runState } = await supabase
      .from("benchmark_runs")
      .select("status")
      .eq("id", args.runId)
      .maybeSingle();

    if (runState?.status !== "failed" && runState?.status !== "completed") {
      await updateBenchmarkRunFailure({
        supabase,
        runId: args.runId,
        executionErrorCount: 0,
        failureReason: "run_execution_failure",
      }).catch(() => undefined);
    }

    await supabase.from("audit_events").insert({
      team_id: args.teamId,
      user_id: args.userId,
      event_type: "benchmark.run_failed",
      details: {
        run_id: args.runId,
        run_mode: args.runMode,
        pack_id: args.packId,
        error: error instanceof Error ? error.message : "unknown",
      },
    });
  }
}
