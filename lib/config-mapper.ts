import type { ConfigSnapshot, TeachingPresetId } from "./types";
import { TEACHING_PRESETS } from "./constants";

// Legacy prod schemas can lack configurations.preset_id, so infer it from
// the starter-preset title when possible.
function inferPresetId(row: {
  preset_id?: TeachingPresetId | null;
  name?: string | null;
}): TeachingPresetId | null {
  if (row.preset_id) {
    return row.preset_id;
  }

  const preset = TEACHING_PRESETS.find((item) => item.title === row.name);
  return preset?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRowToConfig(row: any): ConfigSnapshot {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    presetId: inferPresetId(row),

    modelProvider: row.model_provider,
    modelName: row.model_name,
    fallbackModel: row.fallback_model,
    maxOutputTokens: row.max_output_tokens,
    requestTimeoutMs: row.request_timeout_ms,
    retries: row.retries,

    temperature: parseFloat(String(row.temperature)),
    topP: parseFloat(String(row.top_p)),
    topK: row.top_k,
    frequencyPenalty: parseFloat(String(row.frequency_penalty)),
    presencePenalty: parseFloat(String(row.presence_penalty)),

    systemInstruction: row.system_instruction,
    styleProfile: row.style_profile,
    responseFormat: row.response_format,
    fewShotCount: row.few_shot_count,
    safetyPreambleEnabled: row.safety_preamble_enabled,
    citationRequired: row.citation_required,
    abstainRule: row.abstain_rule,

    contextLevel: row.context_level,
    noteWindow: row.note_window,
    sectionToggles: row.section_toggles,
    summaryPrepass: row.summary_prepass,
    ragEnabled: row.rag_enabled,
    ragTopK: row.rag_top_k,
    ragMethod: row.rag_method,
    ragReranker: row.rag_reranker,

    historyDepth: row.history_depth,
    memoryStrategy: row.memory_strategy,

    confidenceFloor: parseFloat(String(row.confidence_floor)),
    perTurnTokenBudget: row.per_turn_token_budget,
    perRunBudgetCap: parseFloat(String(row.per_run_budget_cap)),

    version: row.version,
    configHash: row.config_hash ?? "",
    isFrozen: row.is_frozen,
  };
}
