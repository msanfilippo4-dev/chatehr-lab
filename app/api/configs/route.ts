import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clampNumber,
  readJsonBodyWithLimit,
  trimString,
} from "@/lib/api-request";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { inspectConfigHealth } from "@/lib/config-health";
import { noTeamError } from "@/lib/api-error";
import { getSessionContext } from "@/lib/server-context";
import { isLegacyPresetIdSchemaError } from "@/lib/supabase-compat";

function serializeConfigRow(row: Record<string, unknown>) {
  const config = mapDbRowToConfig(row);
  const health = inspectConfigHealth(config);
  return {
    ...config,
    ...health,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  try {
    const supabase = createAdminClient();
    const ctx = await getSessionContext(supabase, session);
    if (!ctx.team) {
      return routeErrorResponse(
        noTeamError("You must be on a team to view configs.")
      );
    }

    const { data, error } = await supabase
      .from("configurations")
      .select("*")
      .eq("team_id", ctx.team.teamId)
      .order("version", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json((data ?? []).map(serializeConfigRow));
  } catch (error) {
    return routeErrorResponse(error, "Failed to load configurations.");
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const body = await readJsonBodyWithLimit<Record<string, unknown>>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const supabase = createAdminClient();
    const ctx = await getSessionContext(supabase, session);
    if (!ctx.team) {
      return routeErrorResponse(
        noTeamError("You must be on a team to create configs.")
      );
    }

    const input = body.data;

    const { data: latestVersionRow, error: latestVersionError } = await supabase
      .from("configurations")
      .select("version")
      .eq("team_id", ctx.team.teamId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (latestVersionError && latestVersionError.code !== "PGRST116") {
      throw latestVersionError;
    }

    const nextVersion = (latestVersionRow?.version ?? 0) + 1;

    const payload = {
      team_id: ctx.team.teamId,
      created_by: ctx.user.id,
      name: trimString(input.name, 200) || `Config v${nextVersion}`,
      version: nextVersion,
      model_provider: input.modelProvider ?? DEFAULT_CONFIG.modelProvider,
      model_name: trimString(input.modelName, 100) || DEFAULT_CONFIG.modelName,
      fallback_model:
        trimString(input.fallbackModel, 100) || DEFAULT_CONFIG.fallbackModel,
      max_output_tokens: clampNumber(
        input.maxOutputTokens,
        1,
        65_536,
        DEFAULT_CONFIG.maxOutputTokens
      ),
      request_timeout_ms: clampNumber(
        input.requestTimeoutMs,
        1_000,
        120_000,
        DEFAULT_CONFIG.requestTimeoutMs
      ),
      retries: clampNumber(input.retries, 0, 5, DEFAULT_CONFIG.retries),
      temperature: clampNumber(
        input.temperature,
        0,
        2,
        DEFAULT_CONFIG.temperature
      ),
      top_p: clampNumber(input.topP, 0, 1, DEFAULT_CONFIG.topP),
      top_k: clampNumber(input.topK, 1, 100, DEFAULT_CONFIG.topK),
      frequency_penalty: clampNumber(
        input.frequencyPenalty,
        -2,
        2,
        DEFAULT_CONFIG.frequencyPenalty
      ),
      presence_penalty: clampNumber(
        input.presencePenalty,
        -2,
        2,
        DEFAULT_CONFIG.presencePenalty
      ),
      system_instruction:
        trimString(input.systemInstruction, 10_000) ||
        DEFAULT_CONFIG.systemInstruction,
      style_profile: input.styleProfile ?? DEFAULT_CONFIG.styleProfile,
      response_format: input.responseFormat ?? DEFAULT_CONFIG.responseFormat,
      few_shot_count: clampNumber(
        input.fewShotCount,
        0,
        10,
        DEFAULT_CONFIG.fewShotCount
      ),
      safety_preamble_enabled:
        input.safetyPreambleEnabled ?? DEFAULT_CONFIG.safetyPreambleEnabled,
      citation_required:
        input.citationRequired ?? DEFAULT_CONFIG.citationRequired,
      abstain_rule:
        trimString(input.abstainRule, 2_000) || DEFAULT_CONFIG.abstainRule,
      context_level: input.contextLevel ?? DEFAULT_CONFIG.contextLevel,
      note_window: clampNumber(
        input.noteWindow,
        0,
        50,
        DEFAULT_CONFIG.noteWindow
      ),
      section_toggles: input.sectionToggles ?? DEFAULT_CONFIG.sectionToggles,
      summary_prepass: input.summaryPrepass ?? DEFAULT_CONFIG.summaryPrepass,
      rag_enabled: input.ragEnabled ?? DEFAULT_CONFIG.ragEnabled,
      rag_top_k: clampNumber(input.ragTopK, 1, 20, DEFAULT_CONFIG.ragTopK),
      rag_method: input.ragMethod ?? DEFAULT_CONFIG.ragMethod,
      rag_reranker: input.ragReranker ?? DEFAULT_CONFIG.ragReranker,
      history_depth: clampNumber(
        input.historyDepth,
        0,
        100,
        DEFAULT_CONFIG.historyDepth
      ),
      memory_strategy: input.memoryStrategy ?? DEFAULT_CONFIG.memoryStrategy,
      confidence_floor: clampNumber(
        input.confidenceFloor,
        0,
        1,
        DEFAULT_CONFIG.confidenceFloor
      ),
      per_turn_token_budget: clampNumber(
        input.perTurnTokenBudget,
        64,
        65_536,
        DEFAULT_CONFIG.perTurnTokenBudget
      ),
      per_run_budget_cap: clampNumber(
        input.perRunBudgetCap,
        0.01,
        100,
        DEFAULT_CONFIG.perRunBudgetCap
      ),
      config_hash: null,
      is_frozen: false,
    };

    const withPresetId = (supportsPresetId: boolean) => ({
      ...payload,
      ...(supportsPresetId ? { preset_id: input.presetId ?? null } : {}),
    });

    let insertResult = await supabase
      .from("configurations")
      .insert(withPresetId(true))
      .select("*")
      .single();

    if (insertResult.error && isLegacyPresetIdSchemaError(insertResult.error)) {
      insertResult = await supabase
        .from("configurations")
        .insert(withPresetId(false))
        .select("*")
        .single();
    }

    if (insertResult.error || !insertResult.data) {
      throw insertResult.error ?? new Error("Failed to create configuration.");
    }

    await supabase.from("audit_events").insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      event_type: "config.created",
      details: {
        config_id: insertResult.data.id,
        version: nextVersion,
        name: payload.name,
      },
    });

    return NextResponse.json(serializeConfigRow(insertResult.data), {
      status: 201,
    });
  } catch (error) {
    return routeErrorResponse(error, "Failed to create configuration.");
  }
}
