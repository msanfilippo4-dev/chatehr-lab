import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import {
  executeModelWithConfig,
  normalizeModelExecutionError,
} from "@/lib/model-execution";
import { estimateCost } from "@/lib/pricing";
import { retrieveChunks } from "@/lib/rag-retrieval";
import {
  buildInjectedGuidelineContext,
  buildRagObservabilityMetadata,
} from "@/lib/rag-observability";
import { formatModelRunError } from "@/lib/model-run-errors";
import {
  buildPopulationContext,
  evaluatePopulationGroundTruth,
  getPopulationCohortById,
  getPopulationTaskById,
  loadPopulationCohortMembers,
} from "@/lib/population";
import { isMissingSupabaseTableError } from "@/lib/supabase-compat";
import { validateBatchRunnableConfigs } from "@/lib/config-health";
import type {
  ConfigSnapshot,
  ExperimentSlotResult,
  PopulationRunResponse,
  RAGChunk,
} from "@/lib/types";

interface PopulationRunBody {
  cohortId: string;
  taskId: string;
  configIds: string[];
  prompt?: string;
}

function buildSystemInstruction(config: ConfigSnapshot) {
  const sections = [config.systemInstruction];
  if (config.safetyPreambleEnabled) {
    sections.unshift(
      "You are an educational AI assistant helping health informatics students reason about population-health operations. Use evidence, uncertainty, and fairness-aware language."
    );
  }
  if (config.responseFormat === "structured") {
    sections.push("Use sections for Priorities, Evidence, Risks, and Equity Checks.");
  }
  if (config.citationRequired) {
    sections.push("Cite the cohort evidence or retrieved guidance supporting each priority.");
  }
  return sections.join("\n\n");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<PopulationRunBody>(req, 120_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to run population comparison.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to run cohort comparisons.",
      403,
      "no_team"
    );
  }

  const cohort = getPopulationCohortById(trimString(body.data.cohortId, 80));
  if (!cohort) {
    return errorResponse("Cohort not found.", 404, "not_found");
  }

  const task = getPopulationTaskById(cohort, trimString(body.data.taskId, 80));
  if (!task) {
    return errorResponse("Task not found.", 404, "not_found");
  }

  const uniqueConfigIds = Array.from(
    new Set(body.data.configIds.map((id) => trimString(id, 80)).filter(Boolean))
  ).slice(0, 3);

  if (uniqueConfigIds.length < 2) {
    return NextResponse.json(
      { error: "Select at least two saved configurations to compare." },
      { status: 400 }
    );
  }

  const { data: configRows, error: configError } = await supabase
    .from("configurations")
    .select("*")
    .in("id", uniqueConfigIds)
    .eq("team_id", ctx.team.teamId);

  if (configError || !configRows || configRows.length < 2) {
    return routeErrorResponse(
      configError ?? new Error("Failed to load the selected configurations."),
      "Failed to load the selected configurations."
    );
  }

  const configs = uniqueConfigIds
    .map((configId) => configRows.find((row) => row.id === configId))
    .filter(Boolean)
    .map((row) => mapDbRowToConfig(row));

  const invalidConfigs = await validateBatchRunnableConfigs(configs);
  if (invalidConfigs.length > 0) {
    return NextResponse.json(
      {
        error:
          "One or more selected configurations are not ready for population-health batch runs.",
        code: "invalid_configs",
        invalidConfigs,
      },
      { status: 400 }
    );
  }

  const [members, guidelineRows] = await Promise.all([
    loadPopulationCohortMembers(supabase, cohort),
    supabase
      .from("guideline_chunks")
      .select("id, source, title, text, keywords")
      .limit(500),
  ]);

  if (guidelineRows.error) {
    return routeErrorResponse(
      guidelineRows.error,
      "Failed to load guideline data."
    );
  }

  const allGuidelines = (guidelineRows.data ?? []) as RAGChunk[];
  const patientConditions = members.flatMap((member) =>
    member.conditions.map((condition) => condition.display)
  );
  const taskPrompt = trimString(body.data.prompt, 4000) || task.prompt;

  const slotResults: ExperimentSlotResult[] = [];
  for (const config of configs) {
    let ragChunks: Awaited<ReturnType<typeof retrieveChunks>> = [];
    let ragMetadata: ExperimentSlotResult["ragMetadata"];

    try {
      ragChunks =
        config.ragEnabled && allGuidelines.length > 0
          ? await retrieveChunks(
              allGuidelines,
              taskPrompt,
              patientConditions,
              config.ragMethod === "embedding" ? "semantic" : "keyword",
              config.ragTopK
            )
          : [];

      ragMetadata = buildRagObservabilityMetadata({
        enabled: config.ragEnabled,
        method: config.ragMethod,
        topK: config.ragTopK,
        userQuery: taskPrompt,
        patientConditions,
        retrievedChunks: ragChunks,
        includeSourceInInjectedContext: false,
      });

      const promptSections = [
        buildPopulationContext(cohort, task, members, taskPrompt),
      ];
      if (ragChunks.length > 0) {
        promptSections.push(
          buildInjectedGuidelineContext(ragChunks, { includeSource: false })
        );
      }

      const execution = await executeModelWithConfig({
        config,
        request: {
          messages: [{ role: "user", content: promptSections.join("\n\n") }],
          systemInstruction: buildSystemInstruction(config),
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          topP: config.topP,
          topK: config.topK,
        },
        trace: {
          teamId: ctx.team.teamId,
          userId: ctx.user.id,
          sessionId: `${ctx.team.teamId}:population`,
          context: "population",
        },
      });
      const { response } = execution;

      const cost = estimateCost(
        response.model,
        response.inputTokens,
        response.outputTokens
      );
      const groundTruthCheck = evaluatePopulationGroundTruth(
        task,
        members,
        response.text
      );

      slotResults.push({
        configId: config.id!,
        configName: config.name || "Saved Config",
        modelName: response.model,
        modelProvider: execution.provider,
        status: "completed",
        output: response.text,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
        estimatedCost: cost.totalCost,
        latencyMs: response.latencyMs,
        ragChunks,
        ragMetadata,
        groundTruthCheck: groundTruthCheck ?? undefined,
      });
    } catch (error) {
      const modelError = normalizeModelExecutionError({
        error,
        provider: config.modelProvider,
        modelName: config.modelName,
      });

      slotResults.push({
        configId: config.id!,
        configName: config.name || "Saved Config",
        modelName: modelError.modelName,
        modelProvider:
          modelError.provider === "gemini" || modelError.provider === "openrouter"
            ? modelError.provider
            : config.modelProvider,
        status: "failed",
        error: {
          code: modelError.code,
          message: formatModelRunError(modelError, config),
          transient: modelError.transient,
        },
        output: "",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: 0,
        ragChunks,
        ragMetadata,
      });
    }
  }

  const completedSlots = slotResults.filter((slot) => slot.status !== "failed");
  const failedSlots = slotResults.filter((slot) => slot.status === "failed");
  const partialFailure =
    completedSlots.length > 0 && failedSlots.length > 0;

  const fallbackRun: PopulationRunResponse = {
    id: crypto.randomUUID(),
    teamId: ctx.team.teamId,
    userId: ctx.user.id,
    cohortId: cohort.id,
    cohortName: cohort.title,
    taskId: task.id,
    taskTitle: task.title,
    prompt: taskPrompt,
    slots: slotResults,
    createdAt: new Date().toISOString(),
    persisted: false,
    partialFailure,
    completedSlotCount: completedSlots.length,
    failedSlotCount: failedSlots.length,
  };

  const { data, error } = await supabase
    .from("population_runs")
    .insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      cohort_id: cohort.id,
      cohort_name: cohort.title,
      task_id: task.id,
      task_title: task.title,
      prompt: taskPrompt,
      slots: slotResults,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingSupabaseTableError(error, "population_runs")) {
      if (completedSlots.length === 0) {
        const failedMessage =
          failedSlots[0]?.error?.message ??
          "All selected configurations failed to complete.";
        return NextResponse.json(
          {
            error: failedMessage,
            code: "unknown_error",
            completedSlotCount: 0,
            failedSlotCount: failedSlots.length,
          },
          { status: 502 }
        );
      }
      return NextResponse.json(fallbackRun);
    }
    return routeErrorResponse(error, "Failed to save population run.");
  }

  if (!data) {
    return routeErrorResponse(
      new Error("Population run was not returned after insert."),
      "Failed to save population run."
    );
  }

  if (completedSlots.length > 0) {
    await supabase.from("team_observability_snapshots").insert(
      completedSlots.map((slot) => ({
        team_id: ctx.team!.teamId,
        source_type: "population",
        source_id: data.id,
        model_name: slot.modelName,
        provider: slot.modelProvider,
        input_tokens: slot.inputTokens,
        output_tokens: slot.outputTokens,
        total_tokens: slot.totalTokens,
        estimated_cost_usd: slot.estimatedCost,
        latency_ms: slot.latencyMs,
        metadata: {
          cohortId: cohort.id,
          cohortName: cohort.title,
          taskId: task.id,
          taskTitle: task.title,
          rag: slot.ragMetadata,
        },
      }))
    );
  }

  const responseBody: PopulationRunResponse = {
    id: data.id,
    teamId: data.team_id,
    userId: data.user_id,
    cohortId: data.cohort_id,
    cohortName: data.cohort_name,
    taskId: data.task_id,
    taskTitle: data.task_title,
    prompt: data.prompt,
    slots: data.slots,
    createdAt: data.created_at,
    persisted: true,
    partialFailure,
    completedSlotCount: completedSlots.length,
    failedSlotCount: failedSlots.length,
  };

  if (completedSlots.length === 0) {
    const failedMessage =
      failedSlots[0]?.error?.message ??
      "All selected configurations failed to complete.";
    return NextResponse.json(
      {
        error: failedMessage,
        code: "unknown_error",
        completedSlotCount: 0,
        failedSlotCount: failedSlots.length,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(responseBody);
}
