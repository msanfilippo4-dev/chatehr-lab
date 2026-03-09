// ---------------------------------------------------------------------------
// /api/configs/[id]/freeze — Freeze a config and compute its hash (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeConfigHash } from "@/lib/config-hash";
import type { ConfigSnapshot } from "@/lib/types";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configId = params.id;
  if (!configId) {
    return NextResponse.json({ error: "Config id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Look up user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Fetch the config
  const { data: config, error: fetchErr } = await supabase
    .from("configurations")
    .select("*")
    .eq("id", configId)
    .single();

  if (fetchErr || !config) {
    return NextResponse.json({ error: "Configuration not found." }, { status: 404 });
  }

  // Verify user is on this team
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", config.team_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this config's team." },
      { status: 403 }
    );
  }

  // Check if already frozen
  if (config.is_frozen) {
    return NextResponse.json(
      { error: "This configuration is already frozen." },
      { status: 409 }
    );
  }

  // Build a ConfigSnapshot from the DB row to compute hash
  const snapshot: ConfigSnapshot = {
    modelProvider: config.model_provider,
    modelName: config.model_name,
    fallbackModel: config.fallback_model,
    maxOutputTokens: config.max_output_tokens,
    requestTimeoutMs: config.request_timeout_ms,
    retries: config.retries,

    temperature: parseFloat(config.temperature),
    topP: parseFloat(config.top_p),
    topK: config.top_k,
    frequencyPenalty: parseFloat(config.frequency_penalty),
    presencePenalty: parseFloat(config.presence_penalty),

    systemInstruction: config.system_instruction,
    styleProfile: config.style_profile,
    responseFormat: config.response_format,
    fewShotCount: config.few_shot_count,
    safetyPreambleEnabled: config.safety_preamble_enabled,
    citationRequired: config.citation_required,
    abstainRule: config.abstain_rule,

    contextLevel: config.context_level,
    noteWindow: config.note_window,
    sectionToggles: config.section_toggles,
    summaryPrepass: config.summary_prepass,
    ragEnabled: config.rag_enabled,
    ragTopK: config.rag_top_k,
    ragMethod: config.rag_method,
    ragReranker: config.rag_reranker,

    historyDepth: config.history_depth,
    memoryStrategy: config.memory_strategy,

    confidenceFloor: parseFloat(config.confidence_floor),
    perTurnTokenBudget: config.per_turn_token_budget,

    perRunBudgetCap: parseFloat(config.per_run_budget_cap),

    version: config.version,
    configHash: "",
    isFrozen: false,
  };

  const hash = computeConfigHash(snapshot);

  // Update the config: set frozen + hash
  const { data: updated, error: updateErr } = await supabase
    .from("configurations")
    .update({
      is_frozen: true,
      config_hash: hash,
    })
    .eq("id", configId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    console.error("Failed to freeze config:", updateErr);
    return NextResponse.json({ error: "Failed to freeze configuration." }, { status: 500 });
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: config.team_id,
    user_id: user.id,
    event_type: "config.frozen",
    details: { config_id: configId, config_hash: hash, version: config.version },
  });

  // Return the updated config in camelCase
  return NextResponse.json({
    id: updated.id,
    teamId: updated.team_id,
    name: updated.name,
    version: updated.version,
    configHash: updated.config_hash,
    isFrozen: updated.is_frozen,
    modelProvider: updated.model_provider,
    modelName: updated.model_name,
    createdAt: updated.created_at,
  });
}
