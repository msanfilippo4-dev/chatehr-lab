import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import { getSessionContext } from "@/lib/server-context";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { loadPatientRecord } from "@/lib/patient-loader";
import { buildPatientContext } from "@/lib/patient-context";
import { createModelAdapter } from "@/lib/models";
import { tracedModelCall } from "@/lib/langfuse/trace";
import { estimateCost } from "@/lib/pricing";
import { retrieveChunks } from "@/lib/rag-retrieval";
import {
  buildRagObservabilityMetadata,
} from "@/lib/rag-observability";
import type { ConfigSnapshot, RAGChunk } from "@/lib/types";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<ExperimentRunBody>(req, 120_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) {
    return NextResponse.json(
      { error: "You must be on a team to run experiments." },
      { status: 403 }
    );
  }

  const patient = await loadPatientRecord(supabase, body.data.patientId);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to load the selected configurations." },
      { status: 400 }
    );
  }

  const configs = uniqueConfigIds
    .map((configId) => configRows.find((row) => row.id === configId))
    .filter(Boolean)
    .map((row) => mapDbRowToConfig(row));

  const guidelineRows = await supabase
    .from("guideline_chunks")
    .select("id, source, title, text, keywords")
    .limit(500);
  const allGuidelines = (guidelineRows.data ?? []) as RAGChunk[];
  const patientConditions = patient.conditions.map((condition) => condition.display);

  const slotResults = [];
  for (const config of configs) {
    const ragChunks =
      config.ragEnabled && allGuidelines.length > 0
        ? await retrieveChunks(
            allGuidelines,
            body.data.prompt,
            patientConditions,
            config.ragMethod === "embedding" ? "semantic" : "keyword",
        config.ragTopK
          )
        : [];

    const ragMetadata = buildRagObservabilityMetadata({
      enabled: config.ragEnabled,
      method: config.ragMethod,
      topK: config.ragTopK,
      userQuery: body.data.prompt,
      patientConditions,
      retrievedChunks: ragChunks,
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
        `RETRIEVED GUIDELINES:\n${ragChunks
          .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.text}`)
          .join("\n\n")}`
      );
    }

    promptSections.push(`TASK:\n${body.data.prompt}`);

    const adapter = createModelAdapter(config.modelName);
    const response = await tracedModelCall(
      adapter,
      {
        messages: [{ role: "user", content: promptSections.join("\n\n") }],
        systemInstruction: buildSystemInstruction(config),
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        topP: config.topP,
        topK: config.topK,
      },
      {
        teamId: ctx.team.teamId,
        userId: ctx.user.id,
        sessionId: `${ctx.team.teamId}:experiment`,
        context: "chat",
      }
    );

    const cost = estimateCost(response.model, response.inputTokens, response.outputTokens);

      slotResults.push({
        configId: config.id!,
        configName: config.name || "Saved Config",
      modelName: response.model,
      modelProvider: config.modelProvider,
      output: response.text,
      inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
        estimatedCost: cost.totalCost,
        latencyMs: response.latencyMs,
        ragChunks,
        ragMetadata,
      });
    }

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
    return NextResponse.json(
      { error: "Failed to save experiment run." },
      { status: 500 }
    );
  }

  await supabase.from("team_observability_snapshots").insert(
    slotResults.map((slot) => ({
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

  return NextResponse.json({
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
  });
}
