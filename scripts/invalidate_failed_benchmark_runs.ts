import { existsSync } from "node:fs";

type QueryRow = Record<string, unknown>;

function loadLocalEnv() {
  for (const candidate of [".env.local", ".env"]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
    }
  }
}

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

async function runSql<T extends QueryRow = QueryRow>(
  projectRef: string,
  accessToken: string,
  query: string,
  readOnly = false
) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(readOnly ? { query, read_only: true } : { query }),
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
  loadLocalEnv();

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

  const apply = process.argv.includes("--apply");

  const preview = await runSql<{
    run_id: string;
    team_id: string;
    error_count: number;
  }>(
    projectRef,
    accessToken,
    `
      select
        br.id as run_id,
        br.team_id,
        count(*)::int as error_count
      from benchmark_runs br
      join benchmark_case_results bcr on bcr.run_id = br.id
      where br.status = 'completed'
        and bcr.scoring_details ? 'error'
      group by br.id, br.team_id
      order by br.team_id, br.id;
    `,
    true
  );

  console.log(
    JSON.stringify(
      {
        apply,
        invalidRunCount: preview.length,
        runs: preview,
      },
      null,
      2
    )
  );

  if (!apply || preview.length === 0) {
    return;
  }

  await runSql(
    projectRef,
    accessToken,
    `
      with invalid_runs as (
        select
          br.id as run_id,
          br.team_id,
          count(*)::int as error_count
        from benchmark_runs br
        join benchmark_case_results bcr on bcr.run_id = br.id
        where br.status = 'completed'
          and bcr.scoring_details ? 'error'
        group by br.id, br.team_id
      ),
      updated_runs as (
        update benchmark_runs br
        set
          status = 'failed',
          execution_error_count = invalid_runs.error_count,
          failure_reason = 'case_execution_failure',
          accuracy_score = null,
          safety_score = null,
          bias_equity_score = null,
          tournament_score = null,
          latency_p50_ms = null,
          latency_p95_ms = null
        from invalid_runs
        where br.id = invalid_runs.run_id
        returning br.id, br.team_id, invalid_runs.error_count
      )
      insert into audit_events (team_id, user_id, event_type, details)
      select
        updated_runs.team_id,
        null,
        'benchmark.run_invalidated',
        jsonb_build_object(
          'run_id', updated_runs.id,
          'execution_error_count', updated_runs.error_count,
          'reason', 'historical_case_execution_failure'
        )
      from updated_runs;
    `,
    false
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
