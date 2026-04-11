import { existsSync } from "node:fs";
import { resolve } from "node:path";

type QueryRow = Record<string, unknown>;

function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  for (const fileName of [".env.local", ".env"]) {
    const filePath = resolve(process.cwd(), fileName);
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}

loadLocalEnv();

const STALE_STARTER_MODEL_IDS = [
  "qwen/qwen3-4b:free",
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-20b",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
];

function resolveProjectRef() {
  const explicitRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicitRef) return explicitRef;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function runSql<T extends QueryRow = QueryRow>(
  projectRef: string,
  accessToken: string,
  query: string
) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: true }),
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `SQL API request failed (${response.status} ${response.statusText}): ${text}`
    );
  }

  return text ? (JSON.parse(text) as T[]) : [];
}

async function main() {
  const projectRef = resolveProjectRef();
  if (!projectRef) {
    throw new Error(
      "Missing project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PERSONAL_ACCESS_TOKEN."
    );
  }

  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const [checks] = await runSql<{
    population_runs_exists: boolean;
    benchmark_case_results_exists: boolean;
    preset_id_column_exists: boolean;
    active_team_id_column_exists: boolean;
    evaluation_cost_column_exists: boolean;
    execution_error_count_column_exists: boolean;
    failure_reason_column_exists: boolean;
    smoke_team_column_exists: boolean;
    leaderboard_definition: string;
    stale_starter_config_count: number;
    invalid_completed_run_count: number;
  }>(
    projectRef,
    accessToken,
    `
      with leaderboard_sql as (
        select pg_get_functiondef('get_leaderboard'::regproc) as definition
      ),
      retired_configs as (
        select count(*)::int as count
        from configurations
        where coalesce(is_frozen, false) = false
          and model_name = any(array[${STALE_STARTER_MODEL_IDS.map((id) => `'${id}'`).join(", ")}]::text[])
      ),
      invalid_completed_runs as (
        select count(distinct br.id)::int as count
        from benchmark_runs br
        join benchmark_case_results bcr on bcr.run_id = br.id
        where br.status = 'completed'
          and bcr.scoring_details ? 'error'
      )
      select
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'population_runs'
        ) as population_runs_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'benchmark_case_results'
        ) as benchmark_case_results_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'configurations'
            and column_name = 'preset_id'
        ) as preset_id_column_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'users'
            and column_name = 'active_team_id'
        ) as active_team_id_column_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'benchmark_runs'
            and column_name = 'evaluation_cost_usd'
        ) as evaluation_cost_column_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'benchmark_runs'
            and column_name = 'execution_error_count'
        ) as execution_error_count_column_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'benchmark_runs'
            and column_name = 'failure_reason'
        ) as failure_reason_column_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'teams'
            and column_name = 'is_smoke_test'
        ) as smoke_team_column_exists,
        (select definition from leaderboard_sql) as leaderboard_definition,
        (select count from retired_configs) as stale_starter_config_count,
        (select count from invalid_completed_runs) as invalid_completed_run_count;
    `
  );

  const requiredChecks = [
    ["population_runs_exists", checks.population_runs_exists],
    ["benchmark_case_results_exists", checks.benchmark_case_results_exists],
    ["preset_id_column_exists", checks.preset_id_column_exists],
    ["active_team_id_column_exists", checks.active_team_id_column_exists],
    ["evaluation_cost_column_exists", checks.evaluation_cost_column_exists],
    [
      "execution_error_count_column_exists",
      checks.execution_error_count_column_exists,
    ],
    ["failure_reason_column_exists", checks.failure_reason_column_exists],
    ["smoke_team_column_exists", checks.smoke_team_column_exists],
  ];

  const missing = requiredChecks
    .filter(([, ok]) => !ok)
    .map(([label]) => label);

  const leaderboardDefinition = checks.leaderboard_definition ?? "";
  const leaderboardMissing = [
    !leaderboardDefinition.includes("is_smoke_test")
      ? "leaderboard_missing_smoke_filter"
      : null,
    !leaderboardDefinition.includes("execution_error_count")
      ? "leaderboard_missing_execution_error_filter"
      : null,
  ].filter(Boolean) as string[];

  console.log(
    JSON.stringify(
      {
        projectRef,
        missing,
        leaderboardMissing,
        staleStarterConfigCount: checks.stale_starter_config_count ?? 0,
        invalidCompletedRunCount: checks.invalid_completed_run_count ?? 0,
      },
      null,
      2
    )
  );

  if (missing.length > 0 || leaderboardMissing.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
