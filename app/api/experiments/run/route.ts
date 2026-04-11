import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { validateBatchRunnableConfigs } from "@/lib/config-health";
import { loadPatientRecord } from "@/lib/patient-loader";
import { buildPatientContext } from "@/lib/patient-context";
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
import type {
  ConfigSnapshot,
  ExperimentRunResponse,
  ExperimentSlotResult,
  RAGChunk,
} from "@/lib/types";

interface ExperimentRunBody {
  patientId: string;
  prompt: string;
  configIds: string[];
  recipeId?: string;
  variableFocus?: string;
}

function buildSystemInstruction(config: ConfigSnapshot) {
  const sections = [config.systemInstruction];
  if (config.safetyPreambleEnabled) {
    sections.unshift(
      "You are an educational clinical AI assistant in a simulated EHR. State uncertainty clearly and use chart evidence."
    );
  }
  if (config.responseFormat === "structured") {
    sections.push("Use headings for Assessment, Evidence, Risks, and Recommendation.");
  }
  if (config.citationRequired) {
    sections.push("Cite chart evidence using values, dates, medications, or note details.");
  }
  return sections.join("\n\n");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<ExperimentRunBody>(req, 120_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to run experiment.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to run experiments.",
      403,
      "no_team"
    );
  }

  let patient;
  try {
    patient = await loadPatientRecord(supabase, body.data.patientId);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load patient.");
  }
  if (!patient) {
    return errorResponse("Patient not found.", 404, "not_found");
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
          "One or more selected configurations are not ready for comparison runs.",
        code: "invalid_configs",
        invalidConfigs,
      },
      { status: 400 }
    );
  }

  const guidelineRows = await supabase
    .from("guideline_chunks")
    .select("id, source, title, text, keywords")
    .limit(500);
  if (guidelineRows.error) {
    return routeErrorResponse(
      guidelineRows.error,
      "Failed to load guideline data."
    );
  }
  const allGuidelines = (guidelineRows.data ?? []) as RAGChunk[];
  const patientConditions = patient.conditions.map((condition) => condition.display);

  const slotResults: ExperimentSlotResult[] = [];
  for (const config of configs) {
    let ragChunks: Awaited<ReturnType<typeof retrieveChunks>> = [];
    let ragMetadata: ExperimentSlotResult["ragMetadata"];

    try {
      ragChunks =
        config.ragEnabled && allGuidelines.length > 0
          ? await retrieveChunks(
              allGuidelines,
              body.data.prompt,
              patientConditions,
              config.ragMethod === "embedding" ? "semantic" : "keyword",
              config.ragTopK
            )
          : [];

      ragMetadata = buildRagObservabilityMetadata({
        enabled: config.ragEnabled,
        method: config.ragMethod,
        topK: config.ragTopK,
        userQuery: body.data.prompt,
        patientConditions,
        retrievedChunks: ragChunks,
        includeSourceInInjectedContext: false,
      });

      const promptSections = [
        `PATIENT CONTEXT:\n${buildPatientContext(patient, {
          level: config.contextLevel,
          sectionToggles: config.sectionToggles,
          noteWindow: config.noteWindow,
        })}`,
      ];

      if (ragChunks.length > 0) {
        promptSections.push(
          buildInjectedGuidelineContext(ragChunks, { includeSource: false })
        );
      }

      promptSections.push(`TASK:\n${body.data.prompt}`);

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
          sessionId: `${ctx.team.teamId}:experiment`,
          context: "experiment",
        },
      });
      const { response } = execution;

      const cost = estimateCost(
        response.model,
        response.inputTokens,
        response.outputTokens
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

  const { data, error } = await supabase
    .from("experiment_runs")
    .insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      patient_id: patient.id,
      patient_name: patient.name,
      prompt: trimString(body.data.prompt, 5000),
      recipe_id: body.data.recipeId ?? null,
      variable_focus: trimString(body.data.variableFocus, 160) || null,
      slots: slotResults,
    })
    .select("*")
    .single();

  if (error || !data) {
    return routeErrorResponse(error, "Failed to save experiment run.");
  }

  if (completedSlots.length > 0) {
    await supabase.from("team_observability_snapshots").insert(
      completedSlots.map((slot) => ({
        team_id: ctx.team!.teamId,
        source_type: "experiment",
        source_id: data.id,
        model_name: slot.modelName,
        provider: slot.modelProvider,
        input_tokens: slot.inputTokens,
        output_tokens: slot.outputTokens,
        total_tokens: slot.totalTokens,
        estimated_cost_usd: slot.estimatedCost,
        latency_ms: slot.latencyMs,
        metadata: {
          patientId: patient.id,
          configId: slot.configId,
          rag: slot.ragMetadata,
        },
      }))
    );
  }

  const responseBody: ExperimentRunResponse = {
    id: data.id,
    teamId: data.team_id,
    userId: data.user_id,
    patientId: data.patient_id,
    patientName: data.patient_name,
    prompt: data.prompt,
    recipeId: data.recipe_id,
    variableFocus: data.variable_focus,
    slots: data.slots,
    createdAt: data.created_at,
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
