import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CONFIG, TEACHING_PRESETS } from "@/lib/constants";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { isLegacyPresetIdSchemaError } from "@/lib/supabase-compat";
import { getRepairableStarterPreset } from "@/lib/starter-presets";
import type { TeachingPresetDefinition } from "@/lib/types";

function buildStarterPresetRow(
  preset: TeachingPresetDefinition,
  teamId: string,
  userId: string,
  version: number,
  supportsPresetId: boolean
) {
  const merged = { ...DEFAULT_CONFIG, ...preset.config, presetId: preset.id };

  return {
    team_id: teamId,
    created_by: userId,
    name: preset.title,
    version,
    ...(supportsPresetId ? { preset_id: preset.id } : {}),
    model_provider: merged.modelProvider,
    model_name: merged.modelName,
    fallback_model: merged.fallbackModel,
    max_output_tokens: merged.maxOutputTokens,
    request_timeout_ms: merged.requestTimeoutMs,
    retries: merged.retries,
    temperature: merged.temperature,
    top_p: merged.topP,
    top_k: merged.topK,
    frequency_penalty: merged.frequencyPenalty,
    presence_penalty: merged.presencePenalty,
    system_instruction: merged.systemInstruction,
    style_profile: merged.styleProfile,
    response_format: merged.responseFormat,
    few_shot_count: merged.fewShotCount,
    safety_preamble_enabled: merged.safetyPreambleEnabled,
    citation_required: merged.citationRequired,
    abstain_rule: merged.abstainRule,
    context_level: merged.contextLevel,
    note_window: merged.noteWindow,
    section_toggles: merged.sectionToggles,
    summary_prepass: merged.summaryPrepass,
    rag_enabled: merged.ragEnabled,
    rag_top_k: merged.ragTopK,
    rag_method: merged.ragMethod,
    rag_reranker: merged.ragReranker,
    history_depth: merged.historyDepth,
    memory_strategy: merged.memoryStrategy,
    confidence_floor: merged.confidenceFloor,
    per_turn_token_budget: merged.perTurnTokenBudget,
    per_run_budget_cap: merged.perRunBudgetCap,
    config_hash: null,
    is_frozen: false,
  };
}

export async function GET() {
  return NextResponse.json(TEACHING_PRESETS);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to create starter presets.");
  }
  if (!ctx.team) {
    return errorResponse(
      "You must be on a team to create starter presets.",
      403,
      "no_team"
    );
  }

  const [versionResult, presetAwareResult] = await Promise.all([
    supabase
      .from("configurations")
      .select("version")
      .eq("team_id", ctx.team.teamId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("configurations")
      .select("*")
      .eq("team_id", ctx.team.teamId),
  ]);

  if (versionResult.error) {
    return routeErrorResponse(
      versionResult.error,
      "Failed to inspect existing starter presets."
    );
  }

  let supportsPresetId = true;
  let existingPresetIds = new Set<string>();
  let existingRows: Array<Record<string, unknown>> = [];

  if (presetAwareResult.error) {
    if (!isLegacyPresetIdSchemaError(presetAwareResult.error)) {
      return routeErrorResponse(
        presetAwareResult.error,
        "Failed to inspect existing starter presets."
      );
    }

    supportsPresetId = false;
    const legacyResult = await supabase
      .from("configurations")
      .select("id, name")
      .eq("team_id", ctx.team.teamId);

    if (legacyResult.error) {
      return routeErrorResponse(
        legacyResult.error,
        "Failed to inspect existing starter presets."
      );
    }

    existingPresetIds = new Set(
      (legacyResult.data ?? []).flatMap((row) => {
        const preset = TEACHING_PRESETS.find(
          (item) => item.title === row.name
        );
        return preset ? [preset.id] : [];
      })
    );
    existingRows = legacyResult.data ?? [];
  } else {
    existingPresetIds = new Set(
      (presetAwareResult.data ?? [])
        .map((row) => row.preset_id)
        .filter((value): value is string => Boolean(value))
    );
    existingRows = presetAwareResult.data ?? [];
  }

  const missingPresets = TEACHING_PRESETS.filter(
    (preset) => !existingPresetIds.has(preset.id)
  );

  let nextVersion = (versionResult.data?.version ?? 0) + 1;
  const rows = missingPresets.map((preset) =>
    buildStarterPresetRow(
      preset,
      ctx.team!.teamId,
      ctx.user.id,
      nextVersion++,
      supportsPresetId
    )
  );

  const repairPlans = supportsPresetId
    ? existingRows
        .map((row) => {
          const config = mapDbRowToConfig(row);
          const preset = getRepairableStarterPreset(config);
          return preset ? { row, preset } : null;
        })
        .filter((value): value is { row: Record<string, unknown>; preset: TeachingPresetDefinition } =>
          Boolean(value)
        )
    : [];

  const createdRows: unknown[] = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("configurations")
      .insert(rows)
      .select("*");

    if (error) {
      return routeErrorResponse(error, "Failed to create starter presets.");
    }

    createdRows.push(...(data ?? []));
  }

  if (repairPlans.length > 0) {
    for (const plan of repairPlans) {
      const repairedRow = buildStarterPresetRow(
        plan.preset,
        ctx.team.teamId,
        ctx.user.id,
        Number(plan.row.version ?? 1),
        supportsPresetId
      );
      const {
        team_id: _teamId,
        created_by: _createdBy,
        version: _version,
        ...updatePayload
      } = repairedRow;
      const { error } = await supabase
        .from("configurations")
        .update(updatePayload)
        .eq("id", String(plan.row.id));

      if (error) {
        return routeErrorResponse(error, "Failed to refresh starter presets.");
      }
    }
  }

  const createdCount = rows.length;
  const repairedCount = repairPlans.length;
  const skippedCount = TEACHING_PRESETS.length - createdCount - repairedCount;

  if (createdCount > 0 || repairedCount > 0) {
    await supabase.from("audit_events").insert({
      team_id: ctx.team.teamId,
      user_id: ctx.user.id,
      event_type: "config.starter_presets_synced",
      details: {
        created_preset_ids: missingPresets.map((preset) => preset.id),
        repaired_preset_ids: repairPlans.map((plan) => plan.preset.id),
      },
    });
  }

  const messageParts = [];
  if (createdCount > 0) {
    messageParts.push(
      `Created ${createdCount} starter preset configuration${createdCount === 1 ? "" : "s"}`
    );
  }
  if (repairedCount > 0) {
    messageParts.push(
      `repaired ${repairedCount} stale preset${repairedCount === 1 ? "" : "s"}`
    );
  }
  if (messageParts.length === 0) {
    messageParts.push("Starter presets are already current");
  }

  return NextResponse.json({
    created: createdRows.map(mapDbRowToConfig),
    createdCount,
    repairedCount,
    skippedCount,
    message: `${messageParts.join(" and ")}.`,
  });
}
