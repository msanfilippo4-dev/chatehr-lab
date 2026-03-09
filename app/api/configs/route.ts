// ---------------------------------------------------------------------------
// /api/configs — List configs (GET) and create a new config (POST)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit, clampNumber, trimString } from "@/lib/api-request";
import type { ConfigSnapshot } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { mapDbRowToConfig } from "@/lib/config-mapper";

// ── Helper: get user id and team id from session ────────────────────────────

async function getUserAndTeam(supabase: ReturnType<typeof createAdminClient>, email: string) {
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return null;

  return { userId: user.id, teamId: membership.team_id, role: membership.role };
}

// ── GET — List configs for current team ─────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getUserAndTeam(supabase, session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "You must be on a team to view configs." }, { status: 403 });
  }

  const { data: configs, error } = await supabase
    .from("configurations")
    .select("*")
    .eq("team_id", ctx.teamId)
    .order("version", { ascending: false });

  if (error) {
    console.error("Failed to list configs:", error);
    return NextResponse.json({ error: "Failed to load configurations" }, { status: 500 });
  }

  const result = (configs ?? []).map(mapDbRowToConfig);

  return NextResponse.json(result);
}

// ── POST — Create a new config ──────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<Partial<ConfigSnapshot>>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const supabase = createAdminClient();
  const ctx = await getUserAndTeam(supabase, session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "You must be on a team to create configs." }, { status: 403 });
  }

  const input = body.data;

  // Determine next version number for this team
  const { data: latestConfig } = await supabase
    .from("configurations")
    .select("version")
    .eq("team_id", ctx.teamId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latestConfig?.version ?? 0) + 1;

  // Build the DB row, falling back to DEFAULT_CONFIG for any unset fields
  const row = {
    team_id: ctx.teamId,
    created_by: ctx.userId,
    name: trimString(input.name, 200) || `Config v${nextVersion}`,
    version: nextVersion,

    // Provider / Model
    model_provider: input.modelProvider ?? DEFAULT_CONFIG.modelProvider,
    model_name: trimString(input.modelName, 100) || DEFAULT_CONFIG.modelName,
    fallback_model: trimString(input.fallbackModel, 100) || DEFAULT_CONFIG.fallbackModel,
    max_output_tokens: clampNumber(input.maxOutputTokens, 1, 65536, DEFAULT_CONFIG.maxOutputTokens),
    request_timeout_ms: clampNumber(input.requestTimeoutMs, 1000, 120000, DEFAULT_CONFIG.requestTimeoutMs),
    retries: clampNumber(input.retries, 0, 5, DEFAULT_CONFIG.retries),

    // Sampling
    temperature: clampNumber(input.temperature, 0, 2, DEFAULT_CONFIG.temperature),
    top_p: clampNumber(input.topP, 0, 1, DEFAULT_CONFIG.topP),
    top_k: clampNumber(input.topK, 1, 100, DEFAULT_CONFIG.topK),
    frequency_penalty: clampNumber(input.frequencyPenalty, -2, 2, DEFAULT_CONFIG.frequencyPenalty),
    presence_penalty: clampNumber(input.presencePenalty, -2, 2, DEFAULT_CONFIG.presencePenalty),

    // Prompt Engineering
    system_instruction: trimString(input.systemInstruction, 10000) || DEFAULT_CONFIG.systemInstruction,
    style_profile: input.styleProfile ?? DEFAULT_CONFIG.styleProfile,
    response_format: input.responseFormat ?? DEFAULT_CONFIG.responseFormat,
    few_shot_count: clampNumber(input.fewShotCount, 0, 10, DEFAULT_CONFIG.fewShotCount),
    safety_preamble_enabled: input.safetyPreambleEnabled ?? DEFAULT_CONFIG.safetyPreambleEnabled,
    citation_required: input.citationRequired ?? DEFAULT_CONFIG.citationRequired,
    abstain_rule: trimString(input.abstainRule, 2000) || DEFAULT_CONFIG.abstainRule,

    // Context / RAG
    context_level: input.contextLevel ?? DEFAULT_CONFIG.contextLevel,
    note_window: clampNumber(input.noteWindow, 0, 50, DEFAULT_CONFIG.noteWindow),
    section_toggles: input.sectionToggles ?? DEFAULT_CONFIG.sectionToggles,
    summary_prepass: input.summaryPrepass ?? DEFAULT_CONFIG.summaryPrepass,
    rag_enabled: input.ragEnabled ?? DEFAULT_CONFIG.ragEnabled,
    rag_top_k: clampNumber(input.ragTopK, 1, 20, DEFAULT_CONFIG.ragTopK),
    rag_method: input.ragMethod ?? DEFAULT_CONFIG.ragMethod,
    rag_reranker: input.ragReranker ?? DEFAULT_CONFIG.ragReranker,

    // Memory
    history_depth: clampNumber(input.historyDepth, 0, 100, DEFAULT_CONFIG.historyDepth),
    memory_strategy: input.memoryStrategy ?? DEFAULT_CONFIG.memoryStrategy,

    // Guardrails
    confidence_floor: clampNumber(input.confidenceFloor, 0, 1, DEFAULT_CONFIG.confidenceFloor),
    per_turn_token_budget: clampNumber(input.perTurnTokenBudget, 64, 65536, DEFAULT_CONFIG.perTurnTokenBudget),

    // Budget
    per_run_budget_cap: clampNumber(input.perRunBudgetCap, 0.01, 100, DEFAULT_CONFIG.perRunBudgetCap),

    // Versioning
    config_hash: null,
    is_frozen: false,
  };

  const { data: config, error } = await supabase
    .from("configurations")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create config:", error);
    return NextResponse.json({ error: "Failed to create configuration" }, { status: 500 });
  }

  // Log audit event
  await supabase.from("audit_events").insert({
    team_id: ctx.teamId,
    user_id: ctx.userId,
    event_type: "config.created",
    details: { config_id: config.id, version: nextVersion, name: row.name },
  });

  return NextResponse.json(mapDbRowToConfig(config), { status: 201 });
}
